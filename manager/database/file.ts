import type { FileModifyAction } from "../../common/client.js";
import { logError } from "../../common/logging.js";
import { FileModifyPacket } from "../../common/packet/s2c/FileModifyPacket.js";
import type { FileHandle } from "../../common/supabase.js";
import { Authentication } from "../authentication.js";
import { ClientList } from "../client/list.js";
import { ROOT_FOLDER_ID, routeToPath, supabase, type FolderOrRoot } from "./core.js";
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
const fileIdCache = new Map<number, FileHandle>();

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

export async function getFileHandleById_Cached(id: number) {
    const hit = fileIdCache.get(id);
    if (hit) {
        return hit;
    }
    const value = await getFileHandleId_Database(id);
    if (value) {
        putIntoCache(value);
    }
    return value;
}

/**
 * Attempts to find a file by its name with the ID of its folder.
 *
 * For the folder, either the id of the path (including the specifier "root")
 * or the absolute path may be provided (it will be resolved to an id)
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
    broadcastToClients("add", val.data);
    putIntoCache(val.data);
    return val.data;
}

export async function updateFileHandle(id: number, handle: Partial<FileHandle>) {
    const value = await supabase.from("files").update(handle).eq("id", id).single();
    if (value.error) {
        logError("Failed to update file handle", id, "due to:", value.error);
        return null;
    }
    // TODO: Only emit this to all clients when actually needed data changes
    broadcastToClients("modify", value.data);
    putIntoCache(value.data);
    return value;
}

export async function deleteFileHandle(id: number) {
    const value = await supabase.from("files").delete().eq("id", id).select("*").single();
    // To be safe, we'll always un-cache the file, even when the operation failed
    const hit = fileIdCache.get(id);
    if (hit) {
        // If it is registered within the id cache,
        // it will always be registered within
        // the path cache as well.
        popFromCache(hit);
    }

    if (value.error) {
        logError("Failed to delete file handle", id, "due to:", value.error);
    } else {
        broadcastToClients("delete", value.data);
    }
    return value.error !== null;
}

function popFromCache(handle: FileHandle) {
    const folderId = handle.folder ?? ROOT_FOLDER_ID;
    const submap = fileCache.get(folderId);
    if (!submap) {
        return false;
    }
    return submap.delete(handle.name) && fileIdCache.delete(handle.id);
}

function putIntoCache(handle: FileHandle) {
    const folderId = handle.folder ?? ROOT_FOLDER_ID;
    let submap = fileCache.get(folderId);
    if (!submap) {
        submap = new Map();
        fileCache.set(folderId, submap);
    }
    submap.set(handle.name, handle);
    fileIdCache.set(handle.id, handle);
}

export async function listFilesInFolder_Database(folderId: FolderOrRoot) {
    const selector = supabase.from("files").select("*");
    // We could not possbily (well - technically, we could) know if we have all files in the directory cached
    const data = await parsePostgrestResponse<FileHandle[]>(
        folderId !== ROOT_FOLDER_ID ? selector.eq("folder", folderId) : selector.is("folder", null)
    );
    if (data === null) {
        return null;
    }
    data.forEach(putIntoCache);
    return data;
}

/**
 * Not exposed to force the use of the cache.
 */
function getFileHandle_Database(folder: FolderOrRoot, name: string) {
    const lookup = supabase.from("files").select("*").eq("name", name);
    return parsePostgrestResponse<FileHandle>(folder === ROOT_FOLDER_ID ? lookup.is("folder", null).single() : lookup.eq("folder", folder).single());
}

function getFileHandleId_Database(id: number) {
    return parsePostgrestResponse<FileHandle>(supabase.from("files").select("*").eq("id", id).single());
}

// TODO: Also emit to specific users whenever they receive a file share for themselves
function broadcastToClients(action: FileModifyAction, handle: FileHandle, targetUser?: number) {
    const handler = async (user: number) => {
        if (typeof targetUser === "number" && user !== targetUser) {
            return null;
        }
        const f = handle.folder !== null ? await Database.folder.getById(handle.folder) : "/";
        const r = await Database.folder.resolveRouteById(handle.folder ?? "root" /* converting database to js version of root */);
        const o = await Authentication.permissions.ownership(user, handle);
        if (!o || !f || !r) {
            return null;
        }
        const p = routeToPath(r);
        const $handle = {
            id: handle.id,
            name: handle.name,
            type: handle.type,
            has_thumbnail: handle.has_thumbnail,
            created_at: handle.created_at ?? undefined,
            updated_at: handle.updated_at ?? undefined,
            size: handle.size,
            ownership: o.status === "shared" ? o : { status: o.status, share: undefined }
        };
        return new FileModifyPacket({ action, path: p, handle: $handle });
    };
    ClientList.broadcast(handler);
}
