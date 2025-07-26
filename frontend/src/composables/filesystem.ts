import type { UploadRelativeFileHandle } from "./uploads";

/**
 * Navigates a {@link FileSystemEntry} (folder) object tree to reduce the content
 * of itself (and all subfolders) to all files and their respective paths.
 *
 * If a file is inputted ({@link FileSystemFileEntry}), then only that file is returned
 * @param entry The file system entry received from the drop event
 */
export async function traverseFileTree(entry: FileSystemEntry): Promise<UploadRelativeFileHandle[]> {
    const files = new Array<UploadRelativeFileHandle>();
    if (entryIsFile(entry)) {
        await new Promise((resolve) => {
            entry.file((fileHandle) => {
                // The fullPath property includes the file name, that has to go!
                // Every slash - except for the last trailing slash - is retained
                files.push({ file: fileHandle, relativePath: entry.fullPath.replace(/\/[^/]*$/, "") || "/" });
                resolve(null);
            });
        });
    } else if (entryIsDirectory(entry)) {
        // If it's a directory, read its contents
        const reader = entry.createReader();
        await new Promise((resolve) => {
            reader.readEntries(async (entries) => {
                for (const childEntry of entries) {
                    files.push(...(await traverseFileTree(childEntry)));
                }
                resolve(null);
            });
        });
    } else {
        // By any means, impossible!
        throw new TypeError("Received a file system entry that is neither file nor folder");
    }
    return files;
}

function entryIsFile(entry: FileSystemEntry): entry is FileSystemFileEntry {
    return entry.isFile;
}

function entryIsDirectory(entry: FileSystemEntry): entry is FileSystemDirectoryEntry {
    return entry.isDirectory;
}
