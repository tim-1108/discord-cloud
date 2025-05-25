import jwt, { JsonWebTokenError } from "jsonwebtoken";
import { getEnvironmentVariables } from "../common/environment.js";
import { getUserFromDatabase } from "./database/users.js";
import { Buffer } from "node:buffer";
import { patterns } from "../common/patterns.js";
import { validateObjectBySchema, type SchemaToType } from "../common/validator.js";
import { Database } from "./database/index.js";
import { logWarn } from "../common/logging.js";

const env = getEnvironmentVariables("crypto");
const privateKey = Buffer.from(env.PRIVATE_KEY, "base64");
const publicKey = Buffer.from(env.PUBLIC_KEY, "base64");

const tokenStructure = {
    user: { type: "number", min: 0, required: true },
    hash: { type: "string", pattern: patterns.hash, required: true },
    iat: { type: "number", min: 0, required: true }
} as const;

type Token = SchemaToType<typeof tokenStructure>;

async function generateUserToken(user: number) {
    const handle = await getUserFromDatabase(user);
    if (!handle) return null;
    return jwt.sign({ user, hash: handle.password }, privateKey, { algorithm: "RS256" });
}

async function verifyUserToken(token: string) {
    let handle;
    try {
        handle = jwt.verify(token, publicKey);
    } catch (error) {
        if (!(error instanceof JsonWebTokenError)) {
            logWarn("Unknown jwt error:", error);
        }
        // Most likely an error thrown because the signature is invalid (yeah, an invalid JWT)
        return null;
    }
    if (!validateObjectBySchema(handle, tokenStructure)) {
        return null;
    }

    const $handle = handle as Token;
    const user = await Database.user.get($handle.user);
    // When the user changes their password, every token granted before
    // should be invalidated automatically (as a security concern)
    if (user === null || user.password !== $handle.hash) {
        return null;
    }
    return user.id;
}

function generateSalt(size: number = 0x40) {
    const bytes = crypto.getRandomValues(new Uint8Array(size));
}

/**
 * If the user is the owner of the file, do not call this function,
 * as you can assume full file access.
 */
async function getUserFilePermissions(user: number, file: number) {
    const createRecord = (read: boolean, write: boolean) => ({ read, write });
    const share = await Database.file.share.get(user, file);
    if (share === null) {
        return createRecord(false, false);
    }

    // If the share record exists at all, they can always read
    return createRecord(true, share.can_write);
}

export const Authentication = {
    generateUserToken,
    verifyUserToken,
    permissions: {
        file: getUserFilePermissions
    }
} as const;
