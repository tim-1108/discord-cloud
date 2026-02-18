import type { FolderModifyAction } from "../../common/client.js";
import type { DataErrorFields } from "../../common/index.js";
import { logError } from "../../common/logging.js";
import { FolderModifyPacket } from "../../common/packet/s2c/FolderModifyPacket.js";
import { patterns } from "../../common/patterns.js";
import type { FolderHandle } from "../../common/supabase.js";
import { ClientList } from "../client/list.js";
import { Locks } from "../lock.js";
import { ROOT_FOLDER_ID, routeToPath, supabase, type FolderOrRoot } from "./core.js";
import { Database } from "./index.js";

export const Database$Folder = {
    add: addFolder
};

/**
 * Adds a folder to the database. If a folder of that name already
 * exists within the parent, this function returns the existing handle.
 * Otherweise, a `FolderHandle` to the newly created folder is returned,
 * or `null`, should an error have occured.
 *
 * If `isFromTreeLookup` is specified, the folder is not automatically
 * added to the tree cache, as the caller is doing that already. This
 * may not be the most sustainable method of doing this.
 */
export async function addFolder(name: string, parent: FolderOrRoot, isFromTreeLookup?: boolean): Promise<FolderHandle | null> {
    const parentId = parent === ROOT_FOLDER_ID ? null : parent;

    if (parent !== "root") {
        const parentFolder = Database.folderHandle.getById(parent);
        // The parent folder does not exist. We will not add the folder
        if (!parentFolder) return null;
    }

    // This function should ALWAYS return an existing folder and NOT search
    // for a replacement name. That is not what we want when we create a folder.
    // On renaming and the such, this is fine, but not here.
    const existingFolder = Database.folderHandle.getByNameAndParentId(parent, name);
    if (existingFolder) return existingFolder;

    const { data } = await supabase.from("folders").insert({ name, parent_folder: parentId }).select().single();
    if (data) {
        if (!isFromTreeLookup) {
            Database.tree.add(data);
        }
        broadcastToClients("add", data, {});
    }
    return data;
}

export async function getAllFolders(): Promise<FolderHandle[] | null> {
    // Is this efficient, NO!
    const selector = await supabase.from("folders").select("*").limit(Number.MAX_SAFE_INTEGER);
    if (!selector.data) {
        logError("Failed to retrieve all folders due to:", selector.error);
        return null;
    }
    return selector.data;
}

export async function renameFolder(folderId: number, desiredName: string): Promise<DataErrorFields<FolderHandle>> {
    const handle = Database.folderHandle.getById(folderId);
    if (!handle) {
        return { error: "Failed to find folder handle", data: null };
    }

    if (handle.name === desiredName || !patterns.fileName.test(desiredName) /* a last failsafe, but the packet should have caught this */) {
        return { error: "Target name must not be the same as the current name", data: null };
    }

    const route = await Database.folder.resolveRouteById(folderId);
    if (!route) {
        return { error: "Failed to resolve full route to folder", data: null };
    }

    if (Locks.folder.status(route) || Locks.folder.contentStatus(route))
        return { error: "This folder or its contents are presently locked", data: null };
    Locks.folder.lock(route);

    const existingFolder = Database.folderHandle.getByNameAndParentId(handle.parent_folder ?? "root", desiredName);
    let targetName = desiredName;
    if (existingFolder) {
        const replacement = await Database.replacement.folder(desiredName, handle.parent_folder ?? "root");
        if (!replacement) return { error: "The target name is already taken, but failed to find a replacement name", data: null };
        targetName = replacement;
    }
    const { data } = await supabase.from("folders").update({ name: targetName }).eq("id", handle.id).select().single();
    if (data) {
        Database.tree.rename(folderId, targetName);
        Database.cache.dropFolderIdFromFileCache(folderId);
        void broadcastToClients("rename", data, { rename: handle.name });
    }
    return data ? { error: null, data } : { data: null, error: "Failed to update folder handle in database" };
}

export async function resolveRouteFromFolderId(id: FolderOrRoot): Promise<string[] | null> {
    const route = new Array<string>();
    if (id === "root") {
        return route;
    }

    let $id = id;
    while (true) {
        const handle = Database.folderHandle.getById($id);
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

export async function deleteFolder_Recursive(folderId: FolderOrRoot): Promise<string | null> {
    throw new Error("Not implemented");
}

async function moveFolder(folderId: number, targetParentId: FolderOrRoot) {
    const parent = targetParentId !== "root" ? Database.folderHandle.getById(targetParentId) : true;
    if (!parent) {
        throw new ReferenceError("This target parent folder does not exist: " + targetParentId);
    }
    const response = await supabase
        .from("folders")
        .update({ parent_folder: targetParentId === "root" ? null : targetParentId })
        .eq("id", folderId);

    // TODO: tree move and such
    //void broadcastToClients
}

/**
 * Folder a is merged into folder b.
 */
export async function mergeFolders_Recursive(a: number, b: number, targetParentPath?: string): Promise<DataErrorFields<true>> {
    // TODO: The folder needs to be locked. However, if we lock the folder,
    //       we cannot find replacement names (those check for locks)
    const target = Database.folderHandle.getById(b);
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
        logError(`Failed to retrieve subfolder list for folders ${a} or ${b}`);
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
        await moveFolder(s.id, b);
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
            const $name = await Database.replacement.file(file.name, b, path);
            if ($name === null) {
                flag_isIncomplete = true;
                continue;
            }
            targetName = $name;
        }
        const handle = await Database.file.update(file.id, { folder: b });
        if (!handle) {
            flag_isIncomplete = true;
        }
    }

    // Regardless of whether this was fully successful, we'd best un-cache
    // everything to prevent any possible invalid cache entry.
    Database.cache.dropFolderIdFromFileCache(a);
    if (!flag_isIncomplete) {
        await Database.folder.delete(a);
    }

    return { data: true, error: null };
}

async function broadcastToClients(action: FolderModifyAction, handle: FolderHandle, origins: { rename?: string; parentFolder?: number | null }) {
    const route = await Database.folder.resolveRouteById(handle.id);
    if (!route) {
        return;
    }
    const path = routeToPath(route);
    const packet = new FolderModifyPacket({ action, path, handle, rename_origin: origins.rename, parent_folder_origin: origins.parentFolder });
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
