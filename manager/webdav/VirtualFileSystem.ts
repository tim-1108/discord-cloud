import {
    FileSystem,
    Path,
    RequestContext,
    ResourceType,
    type CopyInfo,
    type CreateInfo,
    type CreationDateInfo,
    type DisplayNameInfo,
    type ILockManager,
    type IPropertyManager,
    type LastModifiedDateInfo,
    type LockManagerInfo,
    type MimeTypeInfo,
    type OpenReadStreamInfo,
    type OpenWriteStreamInfo,
    type PropertyManagerInfo,
    type ReadDirInfo,
    type ReturnCallback,
    type SimpleCallback,
    type SizeInfo,
    type TypeInfo
} from "webdav-server/lib/index.v2.js";
import { Database } from "../database";
import type { Readable, Writable } from "node:stream";
import { PropertyManager } from "./PropertyManager";
import { LockManager } from "./LockManager";
import { patterns } from "../../common/patterns";
import { logInfo } from "../../common/logging";

export class VirtualFileSystem extends FileSystem {
    private propertyManagerInstance = new PropertyManager();
    private lockManagerInstance = new LockManager();

    protected async _fastExistCheck(ctx: RequestContext, path: Path, callback: (exists: boolean) => void): Promise<void> {
        //console.log("_fastExistCheck", path.toString());
        if (!patterns.stringifiedPath.test(path.toString())) {
            return callback(false);
        }
        if (path.isRoot()) {
            return callback(true);
        }
        const folder = Database.folderHandle.get(path.toString());
        if (folder) {
            return callback(true);
        }
        callback(true);
        const file = await Database.file.get(path.getParent().toString(), path.fileName());
        callback(file !== null);
    }

    protected async _create(path: Path, ctx: CreateInfo, callback: SimpleCallback): Promise<void> {
        console.log("_create", path.toString());
        if (ctx.type.isDirectory) {
            const exists = Database.folderHandle.get(path.toString());
            if (exists) {
                return callback(Error("already exists"));
            }
            Database.folder.add(path.fileName(), "root");
            callback();
        } else if (ctx.type.isFile) {
            callback(undefined);
        }
    }

    protected async _readDir(path: Path, ctx: ReadDirInfo, callback: ReturnCallback<string[] | Path[]>): Promise<void> {
        console.log("readdir", path.toString());
        const folderId = Database.folderId.get(path.paths);
        if (folderId === null) {
            return callback(Error("folder not found"));
        }
        const files = await Database.folder.listing.files(folderId);
        const subfolders = await Database.folder.listing.subfolders(folderId);
        if (!files || !subfolders) {
            return callback(Error("failed to get files/subfolders"));
        }

        const getPath = (item: { name: string }) => path.clone().getChildPath(item.name).toString();

        const arr = [...subfolders.map(getPath), ...files.map(getPath)];

        callback(undefined, arr);
    }

    protected async _creationDate(path: Path, ctx: CreationDateInfo, callback: ReturnCallback<number>): Promise<void> {
        console.log("_creationDate", path.toString());
        callback(undefined, 1);
    }

    protected _copy(pathFrom: Path, pathTo: Path, ctx: CopyInfo, callback: ReturnCallback<boolean>): void {
        console.log("readdir", pathFrom.toString());
        callback(undefined, false);
    }

    protected async _mimeType(path: Path, ctx: MimeTypeInfo, callback: ReturnCallback<string>): Promise<void> {
        console.log("_mimeType", path.toString());
        if (path.isRoot()) {
            return callback(Error("is no file"));
        }
        if (!patterns.stringifiedPath.test(path.toString())) {
            return callback(Error("invalid path"));
        }
        const handle = await Database.file.get(path.getParent().toString(), path.fileName());
        if (handle) {
            return callback(undefined, handle.type);
        }
        callback(Error("not found"));
    }

    protected async _size(path: Path, ctx: SizeInfo, callback: ReturnCallback<number>): Promise<void> {
        console.log("_size", path.toString());
        if (path.isRoot()) {
            return callback(undefined, 100000);
        }
        const parent = path.parentName();
        if (parent) {
            const file = await Database.file.get(parent.toString(), path.fileName());
            if (file) {
                return callback(undefined, file.size);
            }
        }

        const folder = Database.folderHandle.get(path.toString());
        if (!folder) {
            return callback(Error("not found"));
        }
        const sizes = Database.tree.fileTypes.getMap(folder.id);
        const totalSize = sizes.values().reduce((value, acc) => acc + value, 0);
        callback(undefined, totalSize);
    }

    protected _lastModifiedDate(path: Path, ctx: LastModifiedDateInfo, callback: ReturnCallback<number>): void {
        console.log("_lastModifiedDate", path.toString());
        callback(undefined, 0);
    }

    protected _displayName(path: Path, ctx: DisplayNameInfo, callback: ReturnCallback<string>): void {
        console.log("_displayName", path.toString());
        callback(undefined, path.isRoot() ? "Root" : path.fileName());
    }

    protected _openWriteStream(path: Path, ctx: OpenWriteStreamInfo, callback: ReturnCallback<Writable>): void {
        console.log("_openWriteStream", path.toString());
        callback(Error("failed to open write stream"));
    }

    protected _openReadStream(path: Path, ctx: OpenReadStreamInfo, callback: ReturnCallback<Readable>): void {
        console.log("_openReadStream", path.toString());
        callback(Error("failed to open read stream"));
    }

    protected _lockManager(path: Path, ctx: LockManagerInfo, callback: ReturnCallback<ILockManager>): void {
        callback(undefined, this.lockManagerInstance);
    }
    protected _propertyManager(path: Path, ctx: PropertyManagerInfo, callback: ReturnCallback<IPropertyManager>): void {
        callback(undefined, this.propertyManagerInstance);
    }
    protected async _type(path: Path, ctx: TypeInfo, callback: ReturnCallback<ResourceType>): Promise<void> {
        //console.log("_type", path.toString());
        if (!patterns.stringifiedPath.test(path.toString())) {
            return callback(Error("invalid path"));
        }
        if (path.isRoot()) {
            return callback(undefined, { isDirectory: true, isFile: false });
        }
        const folder = Database.folderHandle.get(path.toString());
        if (folder) {
            return callback(undefined, { isDirectory: true, isFile: false });
        }
        const parent = path.getParent();
        if (parent) {
            const file = await Database.file.get(parent.toString(), path.fileName());
            if (file) {
                return callback(undefined, { isDirectory: false, isFile: true });
            }
        }
        callback(Error("not found"));
    }
}
