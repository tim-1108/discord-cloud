import { type DatabaseFileRow, type FolderOrRoot, ROOT_FOLDER_ID, supabase } from "./core.js";
import { findFolderByNameAndParent, createOrGetFolderByPath, getFolderById } from "./finding.js";
import { parsePostgrestResponse } from "./helper.js";
import type { UploadMetadata } from "../../common/uploads.js";

export async function createFolderWithParent(name: string, parent: FolderOrRoot) {
    const parentId = parent === ROOT_FOLDER_ID ? null : parent;

    if (parent !== "root") {
        // This call cannot (yet) be cached as
        const parentFolder = await getFolderById(parent);
        // The parent folder does not exist. We will not add the folder
        if (!parentFolder) return null;
    }

    const existingFolder = await findFolderByNameAndParent(name, parent);
    if (existingFolder) return existingFolder;

    const { data } = await supabase.from("folders").insert({ name, parent_folder: parentId }).select().single();
    return data;
}

/**
 * Writes a file with the given name to the database.
 *
 * Resolves the path to a parent folder.
 * If folders in the chain do not yet exist,
 * they will be created.
 *
 * When overwriting a file, provide the unique id.
 *
 * On the database side, an already existing file cannot just be overwritten.
 * Even if not provided in a call of this function,
 * the database automatically removes another entry with the same name
 * and parent folder that already sits in the database.
 * The other entry will not be updated, a new one is created.
 *
 * This "silent replacement" is not communicated to this caller.
 */
export async function addFileToDatabase(
    { path, name, size }: UploadMetadata,
    hash: string,
    type: string,
    isEncrypted: boolean,
    messages: string[],
    channel: string
) {
    // If the folder does not exist, we will always create it.
    const folder = await createOrGetFolderByPath(path);
    if (folder === null) return null;

    return parsePostgrestResponse<DatabaseFileRow>(
        supabase
            .from("files")
            .insert({ name, size, hash, folder: folder === ROOT_FOLDER_ID ? null : folder, messages, is_encrypted: isEncrypted, type, channel })
            .select()
            .single()
    );
}
