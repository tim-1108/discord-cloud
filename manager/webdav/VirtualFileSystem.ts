import {
    Errors,
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
import { PassThrough, type Readable, type Writable } from "node:stream";
import { PropertyManager } from "./PropertyManager";
import { LockManager } from "./LockManager";
import { patterns } from "../../common/patterns";
import { WebDAVHelpers } from "./helpers";
import { streamFileContents } from "../utils/stream-download";
import { createDAVWriteStream } from "./uploader";
import { Authentication } from "../authentication";

// TODO: Use the errors from the Errors object

export class VirtualFileSystem extends FileSystem {
    private propertyManagers = new Map<string, PropertyManager>();
    private lockManagers = new Map<string, LockManager>();

    private creationQueue = new Set<string>();

    private testingFileName = "encryption.txt";

    protected _fastExistCheck(ctx: RequestContext, path: Path, callback: (exists: boolean) => void): void {
        if (path.toString().includes(this.testingFileName)) console.log("_fastExistCheck", path.toString());
        if (!patterns.stringifiedPath.test(path.toString())) {
            return callback(false);
        }
        if (path.isRoot()) {
            return callback(true);
        }

        if (this.creationQueue.has(path.toString())) {
            console.log("_fastexistcheck exists");
            return callback(true);
        }

        const folder = Database.folderHandle.get(path.toString());
        if (folder) {
            return callback(true);
        }
        const params = WebDAVHelpers.getFileRouteFromPath(path);
        if (!params) {
            return callback(false);
        }
        callback(Database.file.cacheOnly.get(params.folderId, params.name) !== null);
    }

    protected async _create(path: Path, ctx: CreateInfo, callback: SimpleCallback): Promise<void> {
        if (path.toString().includes(this.testingFileName)) console.log("_create", path.toString(), ctx.type.isDirectory, ctx.type.isFile);
        if (ctx.type.isDirectory) {
            const exists = Database.folderHandle.get(path.toString());
            if (exists) {
                return callback(Error("already exists"));
            }
            Database.folder.add(path.fileName(), "root");
            callback();
        } else if (ctx.type.isFile) {
            this.creationQueue.add(path.toString());
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
        if (path.toString().includes(this.testingFileName)) console.log("_creationDate", path.toString());
        const file = await WebDAVHelpers.getFileFromPath(path);
        if (file) {
            return callback(undefined, WebDAVHelpers.convertDateStringToUTC(file.created_at));
        }
        callback(undefined, 0);
    }

    protected async _lastModifiedDate(path: Path, ctx: LastModifiedDateInfo, callback: ReturnCallback<number>): Promise<void> {
        if (path.toString().includes(this.testingFileName)) console.log("_lastmodifieddate", path.toString());
        const file = await WebDAVHelpers.getFileFromPath(path);
        if (file) {
            return callback(undefined, WebDAVHelpers.convertDateStringToUTC(file.updated_at));
        }
        callback(undefined, 0);
    }

    protected _copy(pathFrom: Path, pathTo: Path, ctx: CopyInfo, callback: ReturnCallback<boolean>): void {
        console.log("_copy", pathFrom.toString(), pathTo.toString(), ctx);
        callback(undefined, false);
    }

    protected async _mimeType(path: Path, ctx: MimeTypeInfo, callback: ReturnCallback<string>): Promise<void> {
        if (path.toString().includes(this.testingFileName)) console.log("_mimeType", path.toString());
        if (path.isRoot()) {
            return callback(Error("is no file"));
        }
        if (!patterns.stringifiedPath.test(path.toString())) {
            return callback(Error("invalid path"));
        }
        const handle = await WebDAVHelpers.getFileFromPath(path);
        if (handle) {
            return callback(undefined, handle.type);
        }
        callback(Error("not found"));
    }

    protected async _size(path: Path, ctx: SizeInfo, callback: ReturnCallback<number>): Promise<void> {
        if (path.toString().includes(this.testingFileName)) console.log("_size", path.toString());
        const file = await WebDAVHelpers.getFileFromPath(path);
        if (file) {
            return callback(undefined, file.size);
        }

        const folderId = WebDAVHelpers.getFolderIdFromPath(path);
        if (!folderId) {
            return callback(Error("not found"));
        }
        const sizes = Database.tree.fileTypes.getMap(folderId === "root" ? null : folderId);
        const totalSize = sizes.values().reduce((value, acc) => acc + value, 0);
        callback(undefined, totalSize);
    }

    protected _displayName(path: Path, ctx: DisplayNameInfo, callback: ReturnCallback<string>): void {
        callback(undefined, path.isRoot() ? "Root" : path.fileName());
    }

    protected _openWriteStream(path: Path, ctx: OpenWriteStreamInfo, callback: ReturnCallback<Writable>): void {
        console.log("_openWriteStream", path.toString());
        const writable = createDAVWriteStream(path, ctx);
        callback(undefined, writable);
    }

    protected async _openReadStream(path: Path, ctx: OpenReadStreamInfo, callback: ReturnCallback<Readable>): Promise<void> {
        console.log("_openReadStream", path.toString());

        const file = await WebDAVHelpers.getFileFromPath(path);
        if (!file) {
            return callback(Errors.ResourceNotFound);
        }

        const uid = WebDAVHelpers.getUserIdFromContext(ctx);
        const permissions = await Authentication.ownership(uid, file);
        if (!permissions || permissions.can === "none") {
            return callback(Errors.NotEnoughPrivilege);
        }

        const passthrough = new PassThrough({ autoDestroy: true });
        callback(undefined, passthrough);
        // Sadly, the way this library is implemented means that we stream the entire file
        // to this readable and within it is housed a RangedStream. We could do that task
        // ourselves by reading the Range header, but have to send the whole file.
        const status = await streamFileContents(passthrough, file);
        console.log("_openReadStream end", status);
    }

    protected _lockManager(path: Path, ctx: LockManagerInfo, callback: ReturnCallback<ILockManager>): void {
        const value = this.lockManagers.get(path.toString());
        callback(value ? undefined : Errors.MustIgnore, value);
    }
    protected _propertyManager(path: Path, ctx: PropertyManagerInfo, callback: ReturnCallback<IPropertyManager>): void {
        const value = this.propertyManagers.get(path.toString());
        callback(value ? undefined : Errors.MustIgnore, value);
    }
    protected async _type(path: Path, ctx: TypeInfo, callback: ReturnCallback<ResourceType>): Promise<void> {
        if (path.toString().includes(this.testingFileName)) console.log("_type", path.toString());
        if (!patterns.stringifiedPath.test(path.toString())) {
            return callback(Error("invalid path"));
        }
        const folderId = WebDAVHelpers.getFolderIdFromPath(path);
        if (folderId !== null) {
            return callback(undefined, { isDirectory: true, isFile: false });
        }

        if (this.creationQueue.has(path.toString())) {
            return callback(undefined, { isDirectory: false, isFile: true });
        }

        const file = await WebDAVHelpers.getFileFromPath(path);
        if (file) {
            return callback(undefined, { isDirectory: false, isFile: true });
        }
        callback(Error("not found"));
    }
}
