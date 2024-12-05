import { safeDestr } from "destr";
import { encryptBuffer, decryptBuffer } from "../../common/crypto";
import { patterns } from "../../common/patterns";
import { type SchemaToType, validateObjectBySchema } from "../../common/validator";
import { resolvePathToFolderId_Cached, supabase } from "./core";
import { getFileFromDatabase } from "./finding";
import { folderOrRootToDatabaseType, nullOrTypeSelection } from "./helper";

/**
 * Generates an encrypted JSON object containing name, path, and hash.
 *
 * The hash component makes sure that, if the file should be changed,
 * it cannot be downloaded again using the same key.
 * @param name The file name
 * @param path The path to the file
 * @returns An AES encrypted, b64-url encoded JSON object
 */
export async function generateSignedFileDownload(name: string, path: string) {
    const file = await getFileFromDatabase(name, path);
    if (file === null) return null;

    const data = {
        name,
        path,
        hash: file.hash
    };

    const buffer = encryptBuffer(Buffer.from(JSON.stringify(data)));
    return buffer.toString("base64url");
}

/**
 * The schema for validating the encrypted file metadata
 */
const signedFileSchema = {
    name: { type: "string", pattern: patterns.fileName, required: true },
    path: { type: "string", pattern: patterns.stringifiedPath, required: true },
    hash: { type: "string", pattern: patterns.hash, required: true }
} as const;

type SingedFileDownload = SchemaToType<typeof signedFileSchema>;

/**
 * Parses an encrypted signed file object.
 * @param input The b64-url encoded data buffer
 * @returns The decrypted object or null
 */
export function parseSignedFileDownload(input: string) {
    if (!patterns.base64Url.test(input)) return null;
    const buffer = Buffer.from(input, "base64url");
    if (buffer.length < 0x10) return null;
    const decryptedBuffer = decryptBuffer(buffer);
    const decryptedString = decryptedBuffer.toString("ascii");

    if (!/^{.*}$/.test(decryptedString)) return null;

    try {
        const data = safeDestr<SingedFileDownload>(decryptedString);
        const validation = validateObjectBySchema(data, signedFileSchema);
        if (validation.invalid) return null;
        return data;
    } catch {
        return null;
    }
}

export async function deleteFileFromDatabase(id: number) {
    const result = await supabase.from("files").delete().eq("id", id);
    // The data, even if successful, is null.
    // If an error object exists, something has gone wrong.
    return result.error === null;
}

/**
 * Move files from one directory into another
 * @param files A list of file names to move
 * @param sourcePath The path from which to move
 * @param destinationPath The path to which to move
 * @returns The files names and folder once they have been moved, or null on failure
 */
export async function moveFiles(files: string[], sourcePath: string, destinationPath: string) {
    const sourceId = await resolvePathToFolderId_Cached(sourcePath);
    const destinationId = await resolvePathToFolderId_Cached(destinationPath);
    if (!sourceId || !destinationId || sourceId === destinationId) return null;

    // This does not fail if some or all files have not been moved.
    // There is also no check whether all these files even exist.
    // EVEN SO, This poses no security threat.
    const condition = supabase
        .from("files")
        .update({ folder: folderOrRootToDatabaseType(destinationId) })
        .containedBy("name", files);
    const { data } = await nullOrTypeSelection(condition, "folder", folderOrRootToDatabaseType(sourceId)).select("name,folder");

    return data;
}
