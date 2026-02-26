import { safeDestr } from "destr";
import { patterns } from "../common/patterns.js";
import type { FileHandle } from "../common/supabase.js";
import { type SchemaToType, validateObjectBySchema } from "../common/validator.js";
import { SymmetricCrypto } from "../common/symmetric-crypto.js";

export const SignedDownload = {
    generate,
    parse
} as const;

/**
 * Generates an encrypted JSON object containing name, path, and hash.
 *
 * The hash component makes sure that, if the file should be changed,
 * it cannot be downloaded again using the same key.
 * @param handle A file handle from the database
 * @returns An AES encrypted, b64-url encoded JSON object
 */
function generate(handle: FileHandle): string {
    const data = {
        name: handle.name,
        folderId: handle.folder,
        hash: handle.hash
    };

    const buffer = SymmetricCrypto.encrypt(Buffer.from(JSON.stringify(data)));
    return buffer.toString("base64url");
}

const schema = {
    name: { type: "string", pattern: patterns.fileName, required: true },
    folderId: { type: "number", required: true, min: 0, allow_null: true },
    hash: { type: "string", pattern: patterns.hash, required: true }
} as const;

type SignedDownloadObject = SchemaToType<typeof schema>;

/**
 * Parses an encrypted signed download payload. This function
 * does not verify whether the file actually exists and is
 * still valid.
 * @param input The b64-url encoded data buffer
 * @returns The decrypted object or null
 */
function parse(input: string): SignedDownloadObject | null {
    if (!patterns.base64Url.test(input)) return null;
    const buffer = Buffer.from(input, "base64url");
    if (buffer.length < 0x20) return null;
    let buf: Buffer | null;
    try {
        buf = SymmetricCrypto.decrypt(buffer);
        if (buf === null) return null;
    } catch {
        return null;
    }
    const dec = buf.toString("ascii");

    if (!/^{.*}$/.test(dec)) return null;

    try {
        const data = safeDestr<SignedDownloadObject>(dec);
        const validation = validateObjectBySchema(data, schema);
        return validation.invalid ? null : validation.value;
    } catch {
        return null;
    }
}
