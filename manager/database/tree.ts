import { logError, logWarn } from "../../common/logging.js";
import type { FolderHandle } from "../../common/supabase.js";
import { pathToRoute, type FolderOrRoot } from "./core.js";
import { Database } from "./index.js";

/**
 * Due to the fact that this tree is initialized upon boot,
 * we can expect this tree to be exhaustive of all folders
 * in existence (unless somebody else writes to the database).
 *
 * For instance, when moving a folder, we expect the id of the
 * target folder to be already within the tree. If not so, we
 * throw an error. So this system really relies on that fact.
 */

// TODO: File uploading, modify, deletion and folder creation/dropping
//       does not yet call anything in here. Change that.

let initialized = false;
let initializing = false;

interface RootBranch {
    subfolders: Map<string, Branch>;
    types: Map<string, number>;
    is_root: boolean;
}

interface Branch extends RootBranch {
    name: string;
    id: number;
    parent: RootBranch | Branch;
    is_root: false;
}

type TypeSizeArray = { sum: number; type: string; folder: number | null }[];
type TypeSizeMap = Map<string, number>;

function createStruct(name: string, id: number, parent: RootBranch | Branch, types?: Map<string, number>): Branch {
    return { types: types ?? new Map(), subfolders: new Map(), name, parent, id, is_root: false };
}

const root: RootBranch = { types: new Map(), subfolders: new Map(), is_root: true };
const ids = new Map<number, Branch>();

function getStructForPath(path: string | string[]): RootBranch | Branch | null {
    const route = typeof path === "string" ? pathToRoute(path) : path;
    if (route.length === 0) {
        return root;
    }
    let parent = root;
    for (let i = 0; i < route.length; i++) {
        const name = route[i];
        const child = parent.subfolders.get(name);
        if (!child) return null;
        parent = child;
    }
    return parent;
}

async function getOrCreateStructForPath(route: string[]): Promise<RootBranch | Branch | null> {
    if (route.length === 0) {
        return root;
    }
    let parent: RootBranch | Branch = root;
    for (let i = 0; i < route.length; i++) {
        const name = route[i];
        let child: Branch | undefined = parent.subfolders.get(name);
        // As this tree is exhaustive of all folder in existence,
        // if this child does not exist, we can be sure the folder
        // itself does not in fact exist.
        if (child) {
            parent = child;
            continue;
        }
        // The child does not exist yet, we will
        // create it. And if we fail, we have to fail the
        // entire function. This will cause irritation for
        // the user (their upload will fail because we couldn't
        // create a folder, but hey).
        const handle = await Database.folder.add(name, helper_getFolderId(parent), true);
        if (handle === null) {
            logError(`Failed to create folder "${name}" in ${helper_getFolderId(parent)} - cannot continue lookup`);
            return null;
        }
        // Although this might happen when we just call Database.folder.add
        // (that function also returns an existing folder), we can be sure
        // that the folder did not exist previously due to us looking it up
        // within the exhaustive map of children. If this did in fact go wrong,
        // we'd best know.
        if (ids.has(handle.id)) {
            throw new Error(`Impossible condition: The id ${handle.id} had just a folder created, but it already existed in the tree!`);
        }
        // Currently, this condition is impossible as Database.folder.add does not search
        // for replacement names. It should stay that way.
        if (handle.name !== name) {
            throw new Error(`Name has changed from "${name}" to "${handle.name}" upon creation`);
        }
        const struct = createStruct(handle.name, handle.id, parent);
        parent.subfolders.set(handle.name, struct);
        ids.set(handle.id, struct);
        parent = struct;
    }
    return parent;
}

function getFolderIdForPath(path: string | string[]): FolderOrRoot | null {
    const struct = getStructForPath(path);
    if (!struct) return null;
    return helper_getFolderId(struct);
}

function getFolderHandleForPath(path: string | string[]): FolderHandle | null {
    const route = typeof path === "string" ? pathToRoute(path) : path;
    if (route.length === 0) {
        throw new Error("Attempted to lookup root folder in getFolderHandleForPath");
    }
    const struct = getStructForPath(path);
    if (!struct) return struct;
    return helper_structToFolderHandle(struct as Branch);
}

async function getOrCreateFolderIdForPath(path: string | string[]): Promise<FolderOrRoot | null> {
    const route = typeof path === "string" ? pathToRoute(path) : path;
    const preExistingStruct = getStructForPath(path);
    if (preExistingStruct) return helper_getFolderId(preExistingStruct);

    const struct = await getOrCreateStructForPath(route);
    return struct ? helper_getFolderId(struct) : null;
}

async function getOrCreateFolderHandleForPath(path: string | string[]): Promise<FolderHandle | null> {
    const route = typeof path === "string" ? pathToRoute(path) : path;
    if (route.length === 0) {
        throw new Error("Attempted to lookup root folder in getOrCreateFolderHandleForPath");
    }
    const preExistingStruct = getStructForPath(path);
    if (preExistingStruct) return helper_structToFolderHandle(preExistingStruct as Branch);

    const struct = await getOrCreateStructForPath(route);
    if (struct === null) {
        return null;
    }
    return helper_structToFolderHandle(struct as Branch);
}

function getFolderHandleForId(id: number): FolderHandle | null {
    const struct = getStructForId(id);
    if (!struct) return null;
    return helper_structToFolderHandle(struct);
}

/**
 * Returns a folder based on the id of the parent and the
 * name of the folder. Useful for when the caller does not
 * know the path of the parent.
 *
 * If the folder from `parentId` is not found or the requested
 * subfolder does not exist, `null` is returned. It does not
 * just throw, because unverified user input may be sent here,
 * for instance in a packet where just a folder id is specified.
 * @param parentId A folder id or `root`
 * @param name The valid name of the folder
 */
function getFolderHandleByNameAndParentId(parentId: FolderOrRoot, name: string): FolderHandle | null {
    const parent = parentId === "root" ? root : getStructForId(parentId);
    if (!parent) return null;
    const struct = parent.subfolders.get(name);
    if (!struct) return null;
    return helper_structToFolderHandle(struct);
}

function getStructForId(id: number): Branch | null {
    return ids.get(id) ?? null;
}

function getStructForIdOrThrow(id: number): Branch {
    const struct = getStructForId(id);
    if (!struct) throw new ReferenceError("Folder struct not found for id " + id);
    return struct;
}

// This should actually be pretty useless as all this is executed sync
function throwIfUninitialized() {
    if (!initialized) {
        throw new Error("Tree is not initialized");
    }
}

// ===
// Tree creation
// ===

function createTree(handles: FolderHandle[], sizes_input: TypeSizeArray) {
    if (initialized || initializing) {
        throw new Error("Tree already initialized");
    }
    initializing = true;

    // A relation between one folder and many subfolders.
    // "null" as a key does work and represents the root.
    const folderToSubfolders = new Map<number | null, Set<FolderHandle>>();

    for (const handle of handles) {
        let entry = folderToSubfolders.get(handle.parent_folder);
        if (!entry) {
            entry = new Set<FolderHandle>();
            folderToSubfolders.set(handle.parent_folder, entry);
        }
        entry.add(handle);
    }

    const sizes = new Map<number | null, Map<string, number>>();
    for (const { sum, type, folder } of sizes_input) {
        let entry = sizes.get(folder);
        if (!entry) {
            entry = new Map<string, number>();
            sizes.set(folder, entry);
        }
        entry.set(type, sum);
    }

    // Builds the tree recursivly by starting at the subfolders of root.
    function recursive(handle: FolderHandle, parent: RootBranch): Branch {
        const size = sizes.get(handle.id);
        const thisBranch = createStruct(handle.name, handle.id, parent, size);
        const subfolders = folderToSubfolders.get(handle.id);

        ids.set(handle.id, thisBranch);

        // This just does not have any subfolders
        if (!subfolders) return thisBranch;
        for (const subfolder of subfolders) {
            const branch = recursive(subfolder, thisBranch);
            thisBranch.subfolders.set(subfolder.name, branch);
        }
        return thisBranch;
    }

    const rootSize = sizes.get(null);
    if (rootSize) {
        root.types = rootSize;
    }

    const ofRoot = folderToSubfolders.get(null);
    // At this point, no folders can exist whatsoever, except for the root.
    if (!ofRoot || !ofRoot.size) return;
    for (const subfolder of ofRoot) {
        const branch = recursive(subfolder, root);
        root.subfolders.set(subfolder.name, branch);
    }
    initialized = true;
}

// ===
// Modifications to the tree
// ===

function dropFolder(id: number): void {
    throwIfUninitialized();

    const struct = getStructForIdOrThrow(id);
    struct.parent.subfolders.delete(struct.name);
    ids.delete(id);
    // If this is not done, all subfolders will remain, although
    // then only accessible via their respective id, which will
    // never be called. Still, waste of memory.
    iterateThroughSubfolders(struct, ({ id }) => ids.delete(id));
}

function moveFolder(id: number, targetParentId: number | null): void {
    throwIfUninitialized();

    const struct = getStructForIdOrThrow(id);
    const parentStruct = targetParentId !== null ? getStructForIdOrThrow(targetParentId) : root;
    const previousParentStruct = struct.parent;
    previousParentStruct.subfolders.delete(struct.name);
    // If this condition has occured, then something in the actual
    // move process must have gone badly wrong
    if (parentStruct.subfolders.has(struct.name)) {
        throw new Error(`Attempted to move folder with name \
            "${struct.name}" into folder ${helper_getFolderId(parentStruct)} \
            from ${helper_getFolderId(previousParentStruct)}`);
    }
    parentStruct.subfolders.set(struct.name, struct);
    struct.parent = parentStruct;
}

/**
 * Adds a folder with the specified handle to the tree.
 *
 * When adding a cascading list of folders, call this function
 * first on the top-level folder added - as should be required
 * when adding folders to the database.
 *
 * This function does not support adding sizes from the get-go,
 * as we expect this to be called when a folder is **created**,
 * and thus has to be empty.
 */
function addFolder(handle: FolderHandle): boolean {
    throwIfUninitialized();

    // We are strict with struct ids. If the parent does not yet exist, we throw.
    const parentStruct = handle.parent_folder === null ? root : getStructForIdOrThrow(handle.parent_folder);
    if (parentStruct.subfolders.has(handle.name)) {
        logWarn("Attempted to add a folder when it had already been registered:", handle, "parent:", parentStruct);
        return false;
    }
    if (ids.has(handle.id)) {
        logWarn("Attempted to add folder when its id is already stored:", handle);
        return false;
    }
    const struct = createStruct(handle.name, handle.id, parentStruct);
    parentStruct.subfolders.set(handle.name, struct);
    ids.set(handle.id, struct);
    return true;
}

function renameFolder(id: number, targetName: string): void {
    throwIfUninitialized();

    // We assume that every id that is passed in here has to exist,
    // as when a folder is renamed, that folder of course has to exist.
    const struct = getStructForIdOrThrow(id);
    const parent = struct.parent;

    if (targetName === struct.name) {
        throw new Error(`Target name of "${targetName}" is already the name of folder ${id}`);
    }

    // Of course, this should NEVER happen because this function should
    // only ever be called once a folder has been renamed in the database.
    if (parent.subfolders.has(targetName)) {
        throw new Error(`Attempted to rename folder ${id} in tree to "${targetName}", despite that name already existing`);
    }

    // We will just (safely) assume that is the same struct
    parent.subfolders.delete(struct.name);
    parent.subfolders.set(targetName, struct);
    struct.name = targetName;
}

// ===
// Type sizes
// ===

function modifyTypeSize(id: number | null, type: string, delta: number): number {
    throwIfUninitialized();

    const struct = typeof id === "number" ? getStructForIdOrThrow(id) : root;
    const existingValue = struct.types.get(type) ?? 0;
    const newValue = Math.max(existingValue + delta, 0);
    if (newValue === 0) {
        struct.types.delete(type);
    } else {
        struct.types.set(type, newValue);
    }
    return newValue;
}

function getCombinedSizes(id: number | null): TypeSizeMap {
    throwIfUninitialized();

    const struct = typeof id === "number" ? getStructForIdOrThrow(id) : root;
    function recursive(struct: RootBranch, input: TypeSizeMap): void {
        for (const [type, sum] of struct.types) {
            const value = input.get(type) ?? 0;
            input.set(type, value + sum);
        }
        for (const [_, subbranch] of struct.subfolders) {
            recursive(subbranch, map);
        }
    }
    const map = new Map<string, number>();
    recursive(struct, map);
    return map;
}

// ===
// Useless helpers
// ===

function helper_getFolderId(struct: RootBranch | Branch): FolderOrRoot {
    return struct.is_root ? "root" : (struct as Branch).id;
}

function helper_structToFolderHandle(struct: Branch): FolderHandle {
    const parentId = helper_getFolderId(struct.parent);
    return {
        parent_folder: parentId === "root" ? null : parentId,
        id: struct.id,
        name: struct.name
    };
}

type IterationFunction = (struct: Branch) => any;
function iterateThroughSubfolders(target: RootBranch /* generic, can also be Branch */, func: IterationFunction) {
    for (const [_, subfolder] of target.subfolders) {
        iterateThroughSubfolders(subfolder, func);
        // By calling this second, the function will first be called on
        // all subfolders of this subfolder (if any) and down and down.
        // Thus, the deepest first subfolder of the whole stack will have
        // `func` called on it first.
        func(subfolder);
    }
}

export const Database$Tree = {
    init: createTree,
    get: {
        path: getStructForPath,
        id: getStructForId
    },
    fileTypes: {
        modify: modifyTypeSize,
        getMap: getCombinedSizes
    },
    add: addFolder,
    move: moveFolder,
    drop: dropFolder,
    rename: renameFolder
} as const;

export const Database$FolderId = {
    getOrCreate: getOrCreateFolderIdForPath,
    get: getFolderIdForPath
};

export const Database$FolderHandle = {
    get: getFolderHandleForPath,
    getOrCreate: getOrCreateFolderHandleForPath,
    getById: getFolderHandleForId,
    getByNameAndParentId: getFolderHandleByNameAndParentId
};
