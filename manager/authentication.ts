import jwt from "jsonwebtoken";
import { getEnvironmentVariables } from "../common/environment.js";
import { Buffer } from "node:buffer";
import { patterns } from "../common/patterns.js";
import { validateObjectBySchema, type SchemaToType } from "../common/validator.js";
import { Database } from "./database/index.js";
import { logError, logWarn } from "../common/logging.js";
import { randomBytes, createHash } from "node:crypto";
import type { FileHandle } from "../common/supabase.js";
import type { FileOwnershipStatus } from "../common/client.js";

const env = getEnvironmentVariables("manager");
const Constants = {
    privateKey: Buffer.from(env.PRIVATE_KEY, "base64"),
    publicKey: Buffer.from(env.PUBLIC_KEY, "base64"),
    /**
     * The number of bytes of the salt. Multiplied by two
     * as the hex value of the bytes is taken.
     */
    saltSize: 32,
    hashingFunction: "sha256"
} as const;

const tokenStructure = {
    user: { type: "number", min: 0, required: true },
    hash: { type: "string", pattern: patterns.hash, required: true },
    iat: { type: "number", min: 0, required: true }
} as const;

type Token = SchemaToType<typeof tokenStructure>;

async function generateUserToken(user: number) {
    const handle = await Database.users.get(user);
    if (!handle) return null;
    return jwt.sign({ user, hash: handle.password }, Constants.privateKey, { algorithm: "RS256" });
}

async function verifyUserToken(token: string | null | undefined) {
    let handle;
    try {
        handle = jwt.verify(token ?? "", Constants.publicKey);
    } catch (error) {
        if (!(error instanceof jwt.JsonWebTokenError)) {
            logWarn("Unknown jwt error:", error);
        }
        // Most likely an error thrown because the signature is invalid (yeah, an invalid JWT)
        return null;
    }
    if (!validateObjectBySchema(handle, tokenStructure)) {
        return null;
    }

    const $handle = handle as Token;
    const user = await Database.users.get($handle.user);
    // When the user changes their password, every token granted before
    // should be invalidated automatically (as a security concern)
    if (user === null || user.password !== $handle.hash) {
        return null;
    }
    return user.id;
}

function saltAndHashPassword(password: string) {
    const salt = randomBytes(Constants.saltSize).toString("hex");
    const hash = createHash(Constants.hashingFunction)
        .update(password + salt, "utf-8")
        .digest("hex");
    return { salt, hash };
}

function verifyPasswordWithSalt(storedHash: string, password: string, salt: string) {
    if (!patterns.hex.test(storedHash) || !patterns.hex.test(salt)) {
        logError("Stored salt or password hash invalid:", storedHash, salt);
        return false;
    }
    const hash = createHash(Constants.hashingFunction)
        .update(password + salt, "utf-8")
        .digest("hex");
    return hash === storedHash;
}

async function getUserFileOwnershipStatus(user: number, file: number | FileHandle): Promise<FileOwnershipStatus | null> {
    const $file = typeof file === "number" ? await Database.file.getById(file) : file;
    if ($file === null) {
        return null;
    }
    // A file which has no owner associated is available to all users
    // This should only be possible if a user is deleted from the table
    // (we do not want to delete all files if something has been deleted accidentially)
    if ($file.owner === null) {
        return { status: "public", can: "rw" };
    }

    if ($file.owner === user) {
        return { status: "owned", can: "rw" };
    }

    // Only after the owner check to prevent owned files
    // from showing up as public for the actual owner
    if ($file.is_public) {
        return { status: "public", can: "rw" };
    }

    const share = await Database.file.share.get(user, $file.id);
    if (share) {
        return { status: "shared", share, can: share.can_write ? "rw" : "r" };
    }

    return { status: "restricted", can: "none" };
}

export const Authentication = {
    generateUserToken,
    verifyUserToken,
    ownership: getUserFileOwnershipStatus,
    password: {
        generate: saltAndHashPassword,
        verify: verifyPasswordWithSalt
    }
} as const;
