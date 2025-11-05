import type { FolderModifyAction } from "../../common/client.js";
import type { DataErrorFields } from "../../common/index.js";
import { logError } from "../../common/logging.js";
import { FolderModifyPacket } from "../../common/packet/s2c/FolderModifyPacket.js";
import { patterns } from "../../common/patterns.js";
import type { FolderHandle } from "../../common/supabase.js";
import { ClientList } from "../client/list.js";
import { resolvePathToFolderId_Cached, ROOT_FOLDER_ID, routeToPath, supabase, type FolderOrRoot } from "./core.js";
import { parsePostgrestResponse } from "./helper.js";
import { Database } from "./index.js";

export async function addFolder(name: string, parent: FolderOrRoot) {
    const parentId = parent === ROOT_FOLDER_ID ? null : parent;

    if (parent !== "root") {
        // This call cannot (yet) be cached as
        const parentFolder = await getFolderById_Database(parent);
        // The parent folder does not exist. We will not add the folder
        if (!parentFolder) return null;
    }

    const existingFolder = await Database.folder.getByNameAndParent(name, parent);
    if (existingFolder) return existingFolder;

    const { data } = await supabase.from("folders").insert({ name, parent_folder: parentId }).select().single();
    if (data) {
        broadcastToClients("add", data);
    }
    return data;
}

export async function renameFolder(id: number, targetName: string): Promise<FolderHandle | null> {
    const handle = await Database.folder.getById(id);
    if (!handle) {
        return null;
    }
    if (handle.name === targetName || !patterns.fileName.test(targetName)) {
        return null;
    }
    const existingFolder = await Database.folder.getByNameAndParent(targetName, handle.parent_folder ?? "root");
    if (existingFolder) {
        // TODO: (very compilicated) merge both folders?
        return null;
    }
    const { data } = await supabase.from("folders").update({ name: targetName }).eq("name", targetName).select().single();
    if (data) {
        void broadcastToClients("rename", data, handle.name);
    }
    return data;
}

/**
 * If the caller does not have the path to a folder and
 * only the id, no cache lookup is performed (this may take
 * way longer) and rather, the database is called directly.
 *
 * TODO: Maintain two caches, one mapping folder names and one map for ids
 * @param id
 */
export function getFolderById_Database(id: number) {
    return parsePostgrestResponse<FolderHandle>(supabase.from("folders").select().eq("id", id).single());
}

export function getFolderByNameAndParent_Database(name: string, parent: FolderOrRoot) {
    const selector = supabase.from("folders").select().eq("name", name);
    return parsePostgrestResponse<FolderHandle>(
        parent === ROOT_FOLDER_ID ? selector.is("parent_folder", null).single() : selector.eq("parent_folder", parent).single()
    );
}

export async function resolveRouteFromFolderId(id: FolderOrRoot): Promise<string[] | null> {
    const route = new Array<string>();
    if (id === "root") {
        return route;
    }

    let $id = id;
    while (true) {
        const handle = await Database.folder.getById($id);
        // The lookup has failed and thus, we'll assume the folder does not exist
        // This condition should be impossible on anything past the first folder
        // we check, as all folders are linked and a folder deletion is cascading
        // to all subfolders.
        if (!handle) {
            return null;
        }
        route.push(handle.name);
        // This means we have reached the end of the line.
        if (handle.parent_folder === null) {
            return route.reverse();
        }
        $id = handle.parent_folder;
    }
}

/**
 * Explicitly creates the folder at the given path if not already existent.
 */
export function createOrGetFolderByPath(path: string) {
    return resolvePathToFolderId_Cached(path, true);
}
export function getFolderByPath(path: string) {
    return resolvePathToFolderId_Cached(path, false);
}

export function deleteFolder_Recursive() {
    throw new Error("Not implemented");
}

/**
 * Folder a is merged into folder b.
 */
export async function mergeFolders_Recursive(a: number, b: number, targetParentPath?: string): Promise<DataErrorFields<true>> {
    const target = await Database.folder.getById(b);
    if (!target) {
        return { error: "", data: null };
    }

    let path: string;
    if (!targetParentPath) {
        const route = await Database.folder.resolveRouteById(b);
        if (route === null) {
            return { data: null, error: "Failed to build path" };
        }
        path = routeToPath(route);
    } else {
        // Is this sort of appending different?
        path = `${targetParentPath}/${target.name}`;
    }

    const subfoldersA = await Database.folder.listing.subfolders(a);
    const subfoldersB = await Database.folder.listing.subfolders(b);
    // This does not mean that no subfolders exist, that would be returned
    // as an empty array, rather, an error occured whilst fetching
    if (subfoldersA === null || subfoldersB === null) {
        logError(`Failed to retrieve subfolder list for folders ${a}`);
        return { data: null, error: "Failed to retrieve subfolder list" };
    }

    const [matches, free] = subfoldersA.reduce(
        ([matches, free], a) => {
            // If the subfolder does not exist in the target, we can easily just
            // move over the entire folder without merging. Those are the "free".
            const b = subfoldersB.find((b) => b.name === a.name);
            if (b) {
                matches.set(a, b);
            } else {
                free.push(a);
            }
            return [matches, free];
        },
        [new Map<FolderHandle, FolderHandle>(), new Array<FolderHandle>()]
    );

    for (const [sa, sb] of matches) {
        // At the end, this subfolder is dropped after all subfolders and files
        // have been moved over/merged into the target subfolder of b.
        const result = await mergeFolders_Recursive(sa.id, sb.id);
    }

    for (const s of free) {
    }

    // Now, finally, all files can be ported over
    const files = await Database.folder.listing.files(a);
    if (files === null) {
        return { error: "", data: null };
    }
    // If true, indicates that some things have gone wrong in
    // the merging process. Thus, folder a will not be dropped.
    let flag_isIncomplete = false;
    for (const file of files) {
        let targetName = file.name;
        const exists = await Database.file.get(b, file.name);
        if (exists) {
            const $name = await Database.file.findReplacementName(file.name, b, path);
        }
    }

    return { data: true, error: null };
}

async function broadcastToClients(action: FolderModifyAction, handle: FolderHandle, renameOrigin?: string) {
    const route = await Database.folder.resolveRouteById(handle.id);
    if (!route) {
        return;
    }
    const path = routeToPath(route);
    const packet = new FolderModifyPacket({ action, path, handle, rename_orgin: renameOrigin });
    ClientList.broadcast(packet);
}

export async function getFileCount_folder(id: FolderOrRoot) {
    const query = supabase.from("files").select("count()", { count: "exact" });
    const response = await (id === "root" ? query.is("folder", null).single() : query.eq("folder", id).single());
    return response.data ? (response.data.count ?? 0) : null;
}

export async function getSubfolderCount_folder(id: FolderOrRoot) {
    const query = supabase.from("folders").select("count()", { count: "exact" });
    const response = await (id === "root" ? query.is("parent_folder", null).single() : query.eq("parent_folder", id).single());
    // If there are no rows for it, the "sum" field is null within data
    // We'll correct it to 0, null means an error occured.
    return response.data ? (response.data.count ?? 0) : null;
}
