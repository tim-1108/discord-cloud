import { safeDestr } from "destr";
import { encryptBuffer, decryptBuffer } from "../../common/crypto.js";
import { patterns } from "../../common/patterns.js";
import { type SchemaToType, validateObjectBySchema } from "../../common/validator.js";
import { ROOT_FOLDER_ID, supabase, type FolderOrRoot } from "./core.js";
import { parsePostgrestResponse } from "./helper.js";
import { Database } from "./index.js";
import type { FileHandle, FolderHandle } from "../../common/supabase.js";

/**
 * Generates an encrypted JSON object containing name, path, and hash.
 *
 * The hash component makes sure that, if the file should be changed,
 * it cannot be downloaded again using the same key.
 * @param handle A file handle from the database
 * @returns An AES encrypted, b64-url encoded JSON object
 */
export async function generateSignedFileDownload(handle: FileHandle, path: string) {
    const data = {
        name: handle.name,
        path,
        hash: handle.hash
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
    let buf: Buffer;
    try {
        buf = decryptBuffer(buffer);
    } catch {
        return null;
    }
    const dec = buf.toString("ascii");

    if (!/^{.*}$/.test(dec)) return null;

    try {
        const data = safeDestr<SingedFileDownload>(dec);
        const validation = validateObjectBySchema(data, signedFileSchema);
        if (validation.invalid) return null;
        return data;
    } catch {
        return null;
    }
}

interface SubfolderFilesListItem {
    path: string;
    file: FileHandle;
}

export async function getAllFilesInSubfolders(path: string): Promise<SubfolderFilesListItem[] | null> {
    const id = Database.folderId.get(path);
    if (id === null) {
        return null;
    }

    async function recursive_func(id: FolderOrRoot, array: Array<SubfolderFilesListItem>, path: string): Promise<void> {
        const subfolders = await listSubfolders(id);
        const files = await Database.folder.listing.files(id);

        if (subfolders !== null) {
            for (const s of subfolders) {
                await recursive_func(s.id, array, appendToPath(path, s.name));
            }
        }

        if (files !== null) {
            for (const file of files) {
                array.push({ path, file });
            }
        }
    }

    const arrayRef = new Array<SubfolderFilesListItem>();
    await recursive_func(id, arrayRef, "/" /* everything is relative to the origin of this function call*/);
    return arrayRef;
}

export function listSubfolders(
    folderId: FolderOrRoot,
    sortBy?: { field: string; ascending?: boolean },
    pagination?: { limit: number; offset: number }
): Promise<FolderHandle[] | null> {
    let selector = supabase.from("folders").select("*");
    if (sortBy) {
        selector = selector.order(sortBy.field, { ascending: sortBy.ascending });
    }
    if (pagination) {
        // Here, the 2nd parameter is inclusive, unlike most native JS functions
        selector = selector.range(pagination.offset, pagination.offset + pagination.limit - 1);
    }
    return parsePostgrestResponse<FolderHandle[]>(
        folderId !== ROOT_FOLDER_ID ? selector.eq("parent_folder", folderId) : selector.is("parent_folder", null)
    );
}

function appendToPath(path: string, next: string) {
    // Paths on the server are always valid, as user input from packets is always validated then and there!
    if (path === "/") {
        return `/${next}`;
    }
    return `${path}/${next}`;
}
