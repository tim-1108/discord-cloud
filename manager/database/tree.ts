import { logWarn } from "../../common/logging.js";
import type { FolderHandle } from "../../common/supabase.js";
import { pathToRoute } from "./core.js";

// TODO: File uploading, modify, deletion and folder creation/dropping
//       does not yet call anything in here. Change that.

let initialized = false;
let initializing = false;

interface RootBranch {
    subfolders: Map<string, Branch>;
    types: Map<string, number>;
}

interface Branch extends RootBranch {
    name: string;
    id: number;
    parent: RootBranch | Branch;
}

type TypeSizeArray = { sum: number; type: string; folder: number | null }[];
type TypeSizeMap = Map<string, number>;

function createStruct(name: string, id: number, parent: RootBranch | Branch, types?: Map<string, number>): Branch {
    return { types: types ?? new Map(), subfolders: new Map(), name, parent, id };
}

const root: RootBranch = { types: new Map(), subfolders: new Map() };
const ids = new Map<number, Branch>();

function getStructForPath(path: string): RootBranch | Branch | null {
    const route = pathToRoute(path);
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

function getStructForId(id: number): Branch | null {
    return ids.get(id) ?? null;
}

function getStructForIdOrThrow(id: number): Branch {
    const struct = getStructForId(id);
    if (!struct) throw new ReferenceError("Folder struct not found for id " + id);
    return struct;
}

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

// This should actually be pretty useless as all this is executed sync
function throwIfUninitialized() {
    if (!initialized) {
        throw new Error("Tree is not initialized");
    }
}

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

function moveFolder(id: number, targetParentId: number): void {
    throwIfUninitialized();

    const struct = getStructForIdOrThrow(id);
    const parentStruct = getStructForIdOrThrow(targetParentId);
    const previousParentStruct = struct.parent;
    previousParentStruct.subfolders.delete(struct.name);
    parentStruct.subfolders.set(struct.name, struct);
    struct.parent = parentStruct;
}

function modifyTypeSize(id: number, type: string, delta: number): number {
    throwIfUninitialized();

    const struct = getStructForIdOrThrow(id);
    const existingValue = struct.types.get(type) ?? 0;
    const newValue = Math.max(existingValue + delta, 0);
    if (newValue === 0) {
        struct.types.delete(type);
    } else {
        struct.types.set(type, newValue);
    }
    return newValue;
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

export const Database$Tree = {
    init: createTree,
    get: {
        path: getStructForPath,
        id: getStructForId
    },
    add: addFolder,
    move: moveFolder,
    drop: dropFolder,
    modifyTypeSize,
    getCombinedSizes
} as const;
