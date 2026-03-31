import type { Path } from "webdav-server/lib/index.v2.js";
import type { FileHandle } from "../../common/supabase.js";
import type { FolderOrRoot } from "../database/core.js";
import { Database } from "../database/index.js";
import { patterns } from "../../common/patterns.js";

export const WebDAVHelpers = {
    getFileFromPath,
    getFolderIdFromPath,
    convertDateStringToUTC
} as const;

async function getFileFromPath(path: Path): Promise<FileHandle | null> {
    if (!patterns.stringifiedPath.test(path.toString()) || path.isRoot()) {
        return null;
    }
    const parent = path.getParent();
    if (!parent) {
        return null;
    }
    return Database.file.get(path.getParent().toString(), path.fileName());
}

function getFolderIdFromPath(path: Path): FolderOrRoot | null {
    if (!patterns.stringifiedPath.test(path.toString())) {
        return null;
    }
    if (path.isRoot()) {
        return "root";
    }
    return Database.folderId.get(path.toString());
}

function convertDateStringToUTC(str: string | null): number {
    if (!str) return 0;
    const obj = new Date(str);
    return obj.getTime();
}
