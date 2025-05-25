import { logError } from "../../common/logging.js";
import type { FileHandle } from "../../common/supabase.js";
import { ROOT_FOLDER_ID, supabase, type FolderOrRoot } from "./core.js";
import { parsePostgrestResponse } from "./helper.js";
import { Database } from "./index.js";

/**
 * Maps file name to a handle.
 */
type FileCacheValue = Map<string, FileHandle>;
/**
 * Mapping a folder id to a Map containing the files.
 */
const fileCache = new Map<FolderOrRoot, FileCacheValue>();

type IdOrPath = FolderOrRoot | `/${string}`;

function isPath(input: IdOrPath): input is `/${string}` {
    return typeof input === "string" && input.startsWith("/");
}

export async function resolvePath(input: IdOrPath, createPath: boolean = false): Promise<FolderOrRoot | null> {
    if (!isPath(input)) return input;
    // We do not create the path if it does not exist.
    return createPath ? Database.folder.getOrCreateByPath(input) : Database.folder.getByPath(input);
}

export async function getFileHandleWithPath_Cached(name: string, path: string) {
    const folderId = await Database.folder.getByPath(path);
    if (folderId === null) {
        return null;
    }
    return Database.file.get(folderId, name);
}

/**
 * Attempts to find a file by its name with the ID of its folder.
 *
 * To get the id for a path, use {@link resolvePathToFolderId_Cached}.
 * @param name The file name
 * @param folder Specify the folder id. If "root", the root folder is chosen.
 */
export async function getFileHandle_Cached(folder: IdOrPath, name: string) {
    const folderId = await resolvePath(folder);
    if (folderId === null) {
        return null;
    }

    const fetchAndReturn = async () => {
        const val = await getFileHandle_Database(folderId, name);
        if (val) {
            putIntoCache(val);
        }
        return val;
    };

    const submap = fileCache.get(folderId);
    if (!submap) {
        return fetchAndReturn();
    }
    const hit = submap.get(name) ?? null;
    if (hit === null) {
        return fetchAndReturn();
    }
    return submap.get(name) ?? null;
}

/**
 * These are created by the database automatically upon insert.
 */
type AutoCreatedFileColumns = "id" | "created_at" | "updated_at";
export async function addFileHandle(handle: Omit<FileHandle, AutoCreatedFileColumns>) {
    const val = await supabase.from("files").insert(handle).select().single();
    if (val.error) {
        logError("Failed to add file", handle.folder, handle.name, "to database:", val.error);
        return null;
    }
    putIntoCache(val.data);
    return val.data;
}

export async function updateFileHandle(id: number, handle: Partial<FileHandle>) {
    const value = await supabase.from("files").update(handle).eq("id", id).single();
    if (value.error) {
        logError("Failed to update file handle", id, "due to:", value.error);
        return null;
    }
    putIntoCache(value.data);
    return value;
}

export async function deleteFileHandle(id: number) {
    const value = await supabase.from("files").delete().eq("id", id).single();
    // To be safe, we'll always un-cache the file
    // An inefficient way, but the fastest way to resolve from just the id.
    folder: for (const files of fileCache.values()) {
        for (const handle of files.values()) {
            if (handle.id !== id) continue;
            files.delete(handle.name);
            break folder;
        }
    }

    if (value.error) {
        logError("Failed to delete file handle", id, "due to:", value.error);
    }
    return value.error !== null;
}

function popFromCache(handle: FileHandle) {
    const folderId = handle.folder ?? ROOT_FOLDER_ID;
    const submap = fileCache.get(folderId);
    if (!submap) {
        return false;
    }
    return submap.delete(handle.name);
}

function putIntoCache(handle: FileHandle) {
    const folderId = handle.folder ?? ROOT_FOLDER_ID;
    let submap = fileCache.get(folderId);
    if (!submap) {
        submap = new Map();
        fileCache.set(folderId, submap);
    }
    submap.set(handle.name, handle);
}

/**
 * Not exposed to force the use of the cache.
 */
function getFileHandle_Database(folder: FolderOrRoot, name: string) {
    const lookup = supabase.from("files").select("*").eq("name", name);
    return parsePostgrestResponse<FileHandle>(folder === ROOT_FOLDER_ID ? lookup.is("folder", null).single() : lookup.eq("folder", folder).single());
}
