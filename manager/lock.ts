// Locking for both folders and files prevents them from being renamed, deleted or
// overwritten by one action while another action on it is currently ongoing.
// If a folder above the target is locked, the folder is also considered locked.
// For purposes like deletion, the folder cannot have any of decendants locked.
// Stuff is not stored via ID from DB as that does not yet exist on files that
// are queued to be uploaded.

import { createPrefixedUUID } from "../common/crypto.js";
import type { PrefixedUUIDS } from "../common/index.js";
import { pathToRoute, routeToPath } from "./database/core.js";

/**
 * A synchronous implementation of a locking system for both
 * files and folders to prevent simultanious operations.
 */
export const Locks = {
    folder: {
        status: isFolderLocked,
        status_specific: isFolderLocked_Specific,
        status_exceptSpecific: isFolderLocked_ExceptForSpecific,
        contentStatus: isFolderContentLocked,
        allLocks: getAllLocksForFullPath,
        lock: lockFolder,
        unlock: unlockFolder,
        drop: dropLock
    },
    file: {
        individualStatus: isFileLocked,
        status: isFileAndFolderLocked,
        status_specific: isFileLocked_Specific,
        lock: lockFile,
        unlock: unlockFile
    }
};

export type FolderLockUUID = PrefixedUUIDS["folder-lock"];
export type FileLockUUID = PrefixedUUIDS["file-lock"];

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

function lockFile(path: string | string[], name: string): FileLockUUID {
    const struct = getStructForPath(path);
    const uuid = createPrefixedUUID("file-lock");
    const lock = getOrCreateFileLock(struct, name);
    lock.add(uuid);
    return uuid;
}

function getOrCreateFileLock(folderStruct: RootLockStruct /* more generic than LockStruct */, name: string): Set<FileLockUUID> {
    let lock = folderStruct.locked_files.get(name);
    if (!lock) {
        lock = new Set<FileLockUUID>();
        folderStruct.locked_files.set(name, lock);
    }
    return lock;
}

function lockFolder(path: string | string[]): FolderLockUUID | null {
    path = Array.isArray(path) ? routeToPath(path) : path;
    if (path === "/") {
        return null;
    }
    const struct = getStructForPath(path) as LockStruct;
    const uuid = createPrefixedUUID("folder-lock");
    struct.locks.add(uuid);
    return uuid;
}

function isFolderLocked(path: string | string[]): boolean {
    const route = Array.isArray(path) ? path : pathToRoute(path);
    return traverseRouteLockStatus(route, (struct) => struct.locks.size > 0);
}

function getAllLocksForFullPath(path: string | string[]): Map<FolderLockUUID, string | null> {
    const route = Array.isArray(path) ? path : pathToRoute(path);
    const map = new Map<FolderLockUUID, string | null>();
    if (!route.length) {
        return map;
    }
    let parent = lock;
    for (let i = 0; i < route.length; i++) {
        const name = route[i];
        let struct = parent.subfolders.get(name);
        if (!struct) {
            // Even if the lowest level of folder (or anything above it)
            // does not actually exist, we'll still return the set.
            return map;
        }
        struct.locks.entries().forEach(([key, value]) => map.set(key, value));
    }
    return map;
}

function isFolderLocked_ExceptForSpecific(path: string | string[], lockUUID: FolderLockUUID): boolean {
    const locks = getAllLocksForFullPath(path);
    if (!locks.size) return false;
    return locks.size > 1 ? true : locks.has(lockUUID);
}

/**
 * Not only checks whether the folder at the end of the path is locked
 * with the specified UUID, but for any folder within the chain. This
 * means that if the parent folder is locked with that UUID, the child
 * is also considered locked with it.
 */
function isFolderLocked_Specific(path: string | string[], lockUUID: FolderLockUUID): boolean {
    const route = Array.isArray(path) ? path : pathToRoute(path);
    return traverseRouteLockStatus(route, (struct) => struct.locks.has(lockUUID));
}

/**
 * Internal helper function for the wrappers {@link isFolderLocked} and {@link isFolderLocked_Specific}.
 */
function traverseRouteLockStatus(route: string[], accessor: (struct: LockStruct) => boolean): boolean {
    if (!route.length) {
        return false;
    }
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
        if (accessor(struct)) {
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

function isFileAndFolderLocked(path: string | string[], name: string): boolean {
    const folderFlag = isFolderLocked(path);
    if (folderFlag) {
        return true;
    }
    const struct = getStructForPath(path);
    return struct.locked_files.has(name);
}

function isFileLocked(path: string | string[], name: string): boolean {
    const struct = getStructForPath(path, true);
    return struct?.locked_files.has(name) ?? false;
}

function isFileLocked_Specific(path: string | string[], name: string, lockUUID: FileLockUUID): boolean {
    const struct = getStructForPath(path, true);
    return struct?.locked_files.get(name)?.has(lockUUID) ?? false;
}

function unlockFolder(path: string | string[], lockUUID: FolderLockUUID | "all"): boolean {
    const struct = getStructForPath(path, true);
    if (!struct) {
        return false;
    }
    // is root
    if (!("parent" in struct)) {
        return false;
    }

    if (lockUUID === "all") {
        struct.locks.clear();
        destroyLockIfEmpty(struct);
        return true;
    }

    const flag = struct.locks.delete(lockUUID);
    destroyLockIfEmpty(struct);
    return flag;
}

function unlockFile(path: string | string[], name: string, lockUUID: FileLockUUID | "all"): boolean {
    const struct = getStructForPath(path, true);
    if (!struct) {
        return false;
    }
    let flag: boolean;
    if (lockUUID === "all") {
        flag = struct.locked_files.delete(name);
    } else {
        const locks = struct.locked_files.get(name);
        // If the set does not even exist for the file, we'll return false
        flag = locks?.delete(lockUUID) ?? false;
        if (locks && locks.size === 0) {
            struct.locked_files.delete(name);
        }
    }
    if ("name" in struct) {
        destroyLockIfEmpty(struct);
    }
    return flag;
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
    const isInUse = (target: LockStruct): boolean => target.locks.size > 0 || target.locked_files.size > 0 || target.subfolders.size > 0;
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
    locked_files: Map<string, Set<FileLockUUID>>;
    subfolders: Map<string, LockStruct>;
};

type LockStruct = RootLockStruct & {
    locks: Set<FolderLockUUID>;
    parent: RootLockStruct | LockStruct;
    name: string;
};

function createEmptyStruct<T extends boolean = false>(
    parent: T extends true ? null : RootLockStruct | LockStruct,
    name: T extends true ? null : string,
    isRoot?: T
): T extends true ? RootLockStruct : LockStruct {
    const base = {
        locked_files: new Map<string, Set<FileLockUUID>>(),
        subfolders: new Map<string, LockStruct>()
    };
    if (isRoot) {
        return base as any;
    }
    return { parent, name, locks: new Set(), ...base } as any;
}

let lock = createEmptyStruct(null, null, true);
