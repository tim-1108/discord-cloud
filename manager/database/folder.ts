import type { FolderHandle } from "../../common/supabase.js";
import { resolvePathToFolderId_Cached, ROOT_FOLDER_ID, supabase, type FolderOrRoot } from "./core.js";
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
    return data;
}

/**
 * If the caller does not have the path to a folder and
 * only the id, no cache lookup is performed (this may take
 * way longer) and rather, the database is called directly.
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

/**
 * Explicitly creates the folder at the given path if not already existent.
 */
export function createOrGetFolderByPath(path: string) {
    return resolvePathToFolderId_Cached(path, true);
}
export function getFolderByPath(path: string) {
    return resolvePathToFolderId_Cached(path, false);
}
