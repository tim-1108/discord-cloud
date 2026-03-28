/*
 * This file is responsible for maintaining a tree of all dropped, but not yet
 * submitted uploads. Thus, all of this is relative to the absolute path the user
 * decides to start the upload at.
 */

import { reactive, ref } from "vue";
import { logWarn } from "../../../common/logging";
import { createResolveFunction } from "../../../common/useless";
import { attemptRepairFolderOrFileName, convertRouteToPath } from "./path";
import blacklistedFolders from "@/assets/blacklisted-folders.json";
import { patterns } from "../../../common/patterns";
import type { UploadRelativeFileHandle } from "./uploads";

let stem = reactive(createStem());
/**
 * Used within the UploadSubmitDialog for navigating within the preview.
 * The `append()` and `appendFileList()` functions use this route as a
 * base path from which to append files to the tree. Meaning that if the
 * user drops a folder "abc" whilst at relative path "/a/b/c", the folder
 * will be stored at "/a/b/c/abc".
 *
 * This is NOT the absolute, actual path, which is only determined once
 * the files are submitted!
 */
const previewRoute = ref<string[]>([]);
export const UploadFileSystem = {
    append,
    reset,
    dropFolder,
    removeFile,
    addFolder,
    getRoute: getForRoute,
    getArray,
    appendFileList,
    stem,
    /**
     * A virtual routing for within the upload previews
     */
    relativeRoute: {
        navigateToSubfolder,
        navigateToRoot,
        navigateUp,
        route: previewRoute
    }
} as const;

interface Branch extends Base {
    name: string;
    parent: Base;
}

interface Base {
    subfolders: Map<string, Branch>;
    files: Map<string, File>;
}

export interface UploadStem extends Base {
    fileCount: number;
}

function createBranch(name: string, parent: Base): Branch {
    return { name, subfolders: new Map(), files: new Map(), parent };
}

function createStem(): UploadStem {
    return { subfolders: new Map(), files: new Map(), fileCount: 0 };
}

function getForRoute(route: string[]): Base | null {
    let parent: Base = stem;
    for (let i = 0; i < route.length; i++) {
        const child = parent.subfolders.get(route[i]);
        if (!child) {
            return null;
        }
        parent = child;
    }
    return parent;
}

function dropFolder(route: string[]): boolean {
    if (!route.length) return false;
    const branch = getForRoute(route) as Branch | null;
    if (!branch) return false;
    return branch.parent.subfolders.delete(branch.name);
}

function addFolder(parentRoute: string[], folderName: string): boolean {
    if (!patterns.fileName.test(folderName) || blacklistedFolders.includes(folderName)) return false;
    const branch = getForRoute(parentRoute);
    if (!branch || branch.subfolders.has(folderName)) return false;
    branch.subfolders.set(folderName, createBranch(folderName, branch));
    return true;
}

function removeFile(route: string[], fileName: string): boolean {
    const branch = getForRoute(route);
    if (!branch) return false;
    return branch.files.delete(fileName);
}

function reset(): void {
    stem = reactive(createStem());
}

function getArray() {
    // This array is getting modified in place by the recursive function
    const files = new Array<UploadRelativeFileHandle>(stem.fileCount);
    let index = 0;
    function append(branch: Branch | UploadStem, parentRoute: string[]) {
        const route = "name" in branch ? [...parentRoute, branch.name] : [];
        const path = convertRouteToPath(route);
        for (const [name, file] of branch.files) {
            files[index++] = { file, relativePath: path, name };
        }
        for (const [_, subbranch] of branch.subfolders) {
            append(subbranch, route);
        }
    }
    append(stem, []);
    return files;
}

// === routing ===

function navigateUp(): void {
    if (!previewRoute.value.length) {
        return;
    }
    previewRoute.value.splice(previewRoute.value.length - 1, 1);
}
function navigateToSubfolder(name: string): void {
    previewRoute.value.push(name);
}
function navigateToRoot(): void {
    previewRoute.value = [];
}

// === actual reading ===

async function append(dataTransfer: DataTransfer): Promise<UploadStem> {
    const root = previewRoute.value.length ? getForRoute(previewRoute.value) : stem;
    if (!root) {
        throw new ReferenceError("Failed to find branch for route: " + JSON.stringify(previewRoute.value));
    }
    // In order to get the FileSystemEntry from all dropped files/folders,
    // we need to make sure the webkitGetAsEntry method exists on them.
    // This DOES NOT exist on Firefox for Android
    // (where you cannot even drop anything - it is mobile after all)
    // https://developer.mozilla.org/en-US/docs/Web/API/DataTransferItem/webkitGetAsEntry

    // The function may be renamed to getAsEntry eventually.
    // @ts-expect-error
    const fn: () => FileSystemEntry | null = DataTransferItem.prototype.getAsEntry ?? DataTransferItem.prototype.webkitGetAsEntry;
    if (!fn) return stem;

    const filesAndFolders = Array.from(dataTransfer.items)
        .map((entry) => fn.apply(entry))
        .filter((entry) => entry !== null);
    // We can't just use the FileSystem object on one of these entries
    // to get to the root, those appear to be individual for every folder
    // and file dropped.
    const count = await readEntries(filesAndFolders, root);
    stem.fileCount += count;
    return stem;
}

function appendFileList(files: FileList): UploadStem {
    const root = previewRoute.value.length ? getForRoute(previewRoute.value) : stem;
    if (!root) {
        throw new ReferenceError("Failed to find branch for route: " + JSON.stringify(previewRoute.value));
    }
    for (const file of files) {
        const name = attemptRepairFolderOrFileName(file.name);
        // Yeah, they might just overwrite other files.
        root.files.set(name, file);
    }
    return stem;
}

function readFile(entry: FileSystemFileEntry): Promise<File | null> {
    const { promise, resolve } = createResolveFunction<File | null>();
    entry.file(resolve, (exception) => {
        logWarn(`Failed to read file handle for "${entry.name}" at "${entry.fullPath}", skipping.`, exception);
        // The file will just be skipped
        resolve(null);
    });
    return promise;
}

function readDirectory(entry: FileSystemDirectoryEntry, parent: Base /* most generic */): Promise<number> {
    const reader = entry.createReader();
    const { promise, resolve } = createResolveFunction<number>();

    const name = attemptRepairFolderOrFileName(entry.name);
    // Right now, all blacklisted folders will simply be skipped.
    if (blacklistedFolders.includes(name)) {
        resolve(0);
        return promise;
    }

    if (parent.subfolders.has(name)) {
        logWarn(`"${name}" already exists within the branch`, parent);
    }
    // In most cases, this should not exist yet. But if two
    // folders with illegal names have been adjusted to the
    // same thing, it might. The files and subfolders of both
    // should be kept.
    const branch = parent.subfolders.get(name) ?? createBranch(name, parent);
    parent.subfolders.set(name, branch);

    reader.readEntries(async (entries) => {
        const count = await readEntries(entries, branch);
        resolve(count);
    });
    return promise;
}

async function readEntries(entries: FileSystemEntry[], branch: Base): Promise<number> {
    let count = 0;
    for (const entry of entries) {
        if (entryIsDirectory(entry)) {
            count = count + (await readDirectory(entry, branch));
        } else if (entryIsFile(entry)) {
            const file = await readFile(entry);
            if (!file) continue;
            // We'll assume that entry.name and file.name are always identical.
            const name = attemptRepairFolderOrFileName(file.name);
            branch.files.set(name, file);
            count++;
        } else {
            // By all means, impossible!
            throw new TypeError("Received a file system entry that is neither file nor folder");
        }
    }
    return count;
}

function entryIsFile(entry: FileSystemEntry): entry is FileSystemFileEntry {
    return entry.isFile;
}

function entryIsDirectory(entry: FileSystemEntry): entry is FileSystemDirectoryEntry {
    return entry.isDirectory;
}
