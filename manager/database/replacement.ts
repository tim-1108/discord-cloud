import { logWarn } from "../../common/logging.js";
import { patterns } from "../../common/patterns";
import type { FileHandle, FolderHandle } from "../../common/supabase";
import { convertPathToRoute } from "../../frontend/src/composables/path.js";
import { Locks } from "../lock.js";
import type { FolderOrRoot } from "./core.js";
import { Database } from "./index.js";
import path from "node:path";

/**
 * In Windows explorer, when attempting to rename a file to another that already exists
 * (or pasting it there), Windows will append a suffix like " (1)" to the file name.
 *
 * By default, the file should never actually be overwritten (even if the user has permissions),
 * to prevent acccidental overwrites. This is a safer system and the user may choose to delete
 * any "duplicated" files later on.
 *
 * This function takes the maximum file length into account. If a fitting file name cannot
 * be found, `null` is returned. If successful, the new name is returned.
 */
function file_wrapper(name: string, folderId: FolderOrRoot, path?: string): Promise<string | null> {
    return findReplacementName({ lock: Locks.file.status, database: Database.file.get }, name, folderId, path);
}

/**
 * Allows for the renaming of a folder to not be rejected when the name already exists,
 * but rather can be used to append a suffix like " (1)" to it.
 */
function folder_wrapper(name: string, folderId: FolderOrRoot, path?: string): Promise<string | null> {
    function isLocked_Wrapper(route_init: string[] | string, name: string): boolean {
        const route = typeof route_init === "string" ? convertPathToRoute(route_init).concat([name]) : route_init.concat([name]);
        // We especially want to check contentStatus due to the possibility
        // of a upload running for a file in that folder. The folder would not
        // even have to exist yet, but would be created then. If we were to
        // rename a folder to that new folder's name while the upload is still
        // running, and that current folder would contain a file named as such => bad
        return Locks.folder.status(route) || Locks.folder.contentStatus(route);
    }

    return findReplacementName({ lock: isLocked_Wrapper, database: Database.folder.getByNameAndParent }, name, folderId, path);
}

type Providers = {
    lock: (route: string[] | string, name: string) => boolean;
    database: (folderId: FolderOrRoot, name: string) => Promise<FileHandle | FolderHandle | null>;
};
async function findReplacementName(providers: Providers, input_name: string, folderId: FolderOrRoot, input_path?: string): Promise<string | null> {
    // This may be either a route or a path, the function we call does not care.
    const route = input_path ?? (await Database.folder.resolveRouteById(folderId));
    if (!route) {
        // This should not actually be possible
        logWarn("Failed to resolve route for folder id", folderId);
        return null;
    }

    let handle: FolderHandle | FileHandle | null;
    let i = 1;
    // After a certain point, looking up file names for an infinite time
    // is maybe a little bit too much. At some point, we'll have to quit.
    const LIMIT = 99;
    // Sure, folders don't tend to have extensions, but will apply the
    // same logic for them just for convienience
    const ext = path.extname(input_name);
    const extI = input_name.lastIndexOf(".");
    const qualifiedName = extI > -1 ? input_name.substring(0, extI).trim() : input_name.trim();
    do {
        const suffix = ` (${i})`;
        const result = qualifiedName + suffix + ext;
        if (!patterns.fileName.test(result)) {
            return null;
        }
        // Of course, this lookup could fail for other reasons (network, rate limit, whatever)
        // But for now, we will assume that if this fails, the file is non-existent
        handle = await providers.database(folderId, result);
        // If the file is locked, that might mean that an upload for the
        // same name is currently in progress. In that case, we have to
        // continue with the next possible file name.
        const isLocked = providers.lock(route, result);
        if (handle === null && !isLocked) {
            return result;
        }
        if (i === LIMIT) {
            return null;
        }
        i++;
    } while (handle);
    return null;
}

export default {
    file: file_wrapper,
    folder: folder_wrapper
};
