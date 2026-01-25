// Locking for both folders and files prevents them from being renamed, deleted or
// overwritten by one action while another action on it is currently ongoing.
// If a folder above the target is locked, the folder is also considered locked.
// For purposes like deletion, the folder cannot have any of decendants locked.
// Stuff is not stored via ID from DB as that does not yet exist on files that
// are queued to be uploaded.
// TODO: Renames and deletes should drop the corresponding lock entry
//       Store a reason for the lock (upload, rename, deletion, ...)

import { pathToRoute, routeToPath } from "./database/core.js";

/**
 * A synchronous implementation of a locking system for both
 * files and folders to prevent simultanious operations.
 */
export const Locks = {
    folder: {
        status: isFolderLocked,
        contentStatus: isFolderContentLocked,
        lock: lockFolder,
        unlock: unlockFolder,
        drop: dropLock
    },
    file: {
        status: isFileLocked,
        lock: lockFile,
        unlock: unlockFile
    }
};

function getStructForPath<C extends boolean = false>(
    path: string | string[],
    doNotCreate?: C
): C extends true ? RootLockStruct | LockStruct | null : RootLockStruct | LockStruct {
    const route = typeof path === "string" ? pathToRoute(path) : path;
    if (!route.length) {
        return lock;
    }
    let parent = lock as LockStruct;
    for (let i = 0; i < route.length; i++) {
        const name = route[i];
        let struct = parent.subfolders.get(name);
        if (!struct) {
            if (doNotCreate) {
                return null as any;
            }
            struct = createEmptyStruct(parent, name);
            parent.subfolders.set(name, struct);
        }
        parent = struct;
    }
    return parent as LockStruct;
}

function lockFile(path: string | string[], name: string): void {
    const struct = getStructForPath(path);
    struct.locked_files.add(name);
}

function lockFolder(path: string | string[]): void {
    path = Array.isArray(path) ? routeToPath(path) : path;
    if (path === "/") {
        return;
    }
    const struct = getStructForPath(path) as LockStruct;
    struct.is_locked = true;
}

function isFolderLocked(path: string | string[]): boolean {
    path = Array.isArray(path) ? routeToPath(path) : path;
    if (path === "/") {
        return false;
    }
    const route = pathToRoute(path);
    let parent = lock;
    for (let i = 0; i < route.length; i++) {
        const name = route[i];
        let struct = parent.subfolders.get(name);
        if (!struct) {
            // If a folder in the chain does not exist, the folder
            // at the deepest level cannot be locked.
            return false;
        }
        // Only one folder within the chain needs to be locked for
        // everything below to be locked too.
        if (struct.is_locked) {
            return true;
        }
        parent = struct;
    }
    return false;
}

/**
 * Checks whether anything within the folder's structure is locked.
 * Useful when deleting or renaming the folder to check whether
 * anything is queued within.
 */
function isFolderContentLocked(path: string | string[]): boolean {
    // TODO: also return the actually locked things?
    const struct = getStructForPath(path, true);
    if (!struct) {
        return false;
    }
    function recursive(struct: RootLockStruct /* used here as LockStruct extends it */): boolean {
        if (struct.locked_files.size) {
            return true;
        }
        for (const [_, substruct] of struct.subfolders) {
            const flag = recursive(substruct);
            if (flag) {
                return true;
            }
        }
        return false;
    }
    return recursive(struct);
}

function isFileLocked(path: string | string[], name: string): boolean {
    const folderFlag = isFolderLocked(path);
    if (folderFlag) {
        return true;
    }
    const struct = getStructForPath(path);
    return struct.locked_files.has(name);
}

function unlockFolder(path: string | string[]): boolean {
    const struct = getStructForPath(path, true);
    if (!struct) {
        return false;
    }
    // is root
    if (!("is_locked" in struct)) {
        return false;
    }
    const val = struct.is_locked;
    struct.is_locked = false;
    destroyLockIfEmpty(struct);
    return val;
}

function unlockFile(path: string | string[], name: string): boolean {
    const struct = getStructForPath(path, true);
    if (!struct) {
        return false;
    }
    const val = struct.locked_files.delete(name);
    if ("name" in struct) {
        destroyLockIfEmpty(struct);
    }
    return val;
}

/**
 * Unconditionally drops a lock for a folder at `path` for when a folder
 * has been deleted. Using `unlock` on the folder would only mark `is_locked`
 * as `false` and not destroy all subfolder and file entries within.
 * Before dropping the lock, validate using `contentStatus` that nothing
 * within the folder is locked.
 */
function dropLock(path: string | string[]): boolean {
    path = Array.isArray(path) ? routeToPath(path) : path;
    if (path === "/") {
        return false;
    }
    const struct = getStructForPath(path, true) as LockStruct;
    if (!struct) {
        return false;
    }
    const val = struct.parent.subfolders.delete(struct.name);
    if ("name" in struct.parent) {
        destroyLockIfEmpty(struct.parent);
    }
    return val;
}

function destroyLockIfEmpty(struct: LockStruct /* root should not be destroyed */): boolean {
    const isInUse = (target: LockStruct): boolean => target.is_locked || target.locked_files.size > 0 || target.subfolders.size > 0;
    if (isInUse(struct)) {
        return false;
    }
    // After we have removed the only reference to it, the garbage
    // collector will remove the object at some point.
    // However, after deleting this reference, it might mean that
    // the parent is also unused now. We have to walk the reference chain.
    struct.parent.subfolders.delete(struct.name);
    let parent = struct.parent;
    // Assures us we will stop once we hit the root struct
    while ("name" in parent) {
        if (isInUse(parent)) {
            break;
        }
        // Only by removing the current folder from the parent can
        // the parent then be dropped. At this point in execution,
        // we know the current folder is empty and can be removed.
        const child = parent;
        parent = child.parent;
        parent.subfolders.delete(child.name);
    }
    return true;
}

// The root cannot be locked for editing (it cannot be deleted, modified, and so on)
type RootLockStruct = {
    locked_files: Set<string>;
    subfolders: Map<string, LockStruct>;
};

type LockStruct = RootLockStruct & {
    is_locked: boolean;
    parent: RootLockStruct | LockStruct;
    name: string;
};

function createEmptyStruct<T extends boolean = false>(
    parent: T extends true ? null : RootLockStruct | LockStruct,
    name: T extends true ? null : string,
    isRoot?: T
): T extends true ? RootLockStruct : LockStruct {
    const base = {
        locked_files: new Set<string>(),
        subfolders: new Map<string, LockStruct>()
    };
    if (isRoot) {
        return base as any;
    }
    return { is_locked: false, parent, name, ...base } as any;
}

let lock = createEmptyStruct(null, null, true);
