import {
    type FolderOrRoot,
    type DatabaseFolderRow,
    supabase,
    ROOT_FOLDER_ID,
    type DatabaseFileRow,
    resolvePathToFolderId_Cached,
    type PartialDatabaseFileRow,
    type PartialDatabaseFolderRow
} from "./core";
import { parsePostgrestResponse } from "./helper";

export function findFolderByNameAndParent(name: string, parent: FolderOrRoot): Promise<DatabaseFolderRow | null> {
    const lookup = supabase.from("folders").select("*").eq("name", name);
    return parsePostgrestResponse(
        // We cannot look up null using .eq and cannot look up a number using .is (.is only supports booleans and null)
        parent === ROOT_FOLDER_ID ? lookup.is("parent_folder", null).single() : lookup.eq("parent_folder", parent).single()
    );
}

/**
 * Attempts to find a file by its name with the ID of its folder.
 *
 * To get the id for a path, use {@link resolvePathToFolderId_Cached}.
 * @param name The file name
 * @param folder Specify the folder id. If "root", the root folder is chosen.
 */
function findFileByNameAndFolderId(name: string, folder: FolderOrRoot): Promise<DatabaseFileRow | null> {
    const lookup = supabase.from("files").select("*").eq("name", name);
    return parsePostgrestResponse(folder === ROOT_FOLDER_ID ? lookup.is("folder", null).single() : lookup.eq("folder", folder).single());
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

/**
 * If the caller does not have the path to a folder and
 * only the id, no cache lookup is performed (this may take
 * way longer) and rather, the database is called directly.
 * @param id
 */
export async function getFolderById(id: number): Promise<DatabaseFolderRow | null> {
    return parsePostgrestResponse(supabase.from("folders").select().eq("id", id).single());
}

/**
 * Checks whether a given file name with an according path is registered in the database.
 *
 * Does not create a path if not found!
 */
export async function getFileFromDatabase(name: string, path: string) {
    const folderId = await resolvePathToFolderId_Cached(path, false);
    if (folderId === null) return null;

    return await findFileByNameAndFolderId(name, folderId);
}

export function listFilesAtDirectory(folderId: FolderOrRoot) {
    const selector = supabase.from("files").select("name,created_at,updated_at,size,type");
    return parsePostgrestResponse<PartialDatabaseFileRow[]>(
        folderId !== ROOT_FOLDER_ID ? selector.eq("folder", folderId) : selector.is("folder", null)
    );
}

export function listSubfolders(folderId: FolderOrRoot) {
    const selector = supabase.from("folders").select("name,id");
    return parsePostgrestResponse<PartialDatabaseFolderRow[]>(
        folderId !== ROOT_FOLDER_ID ? selector.eq("parent_folder", folderId) : selector.is("parent_folder", null)
    );
}
