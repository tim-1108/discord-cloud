import type { FileSystem, FileSystemSerializer, ReturnCallback } from "webdav-server/lib/index.v2";

export class VirutalSerializer implements FileSystemSerializer {
    uid(): string {
        return "Virtual-DiscordCloud-Serializer";
    }
    serialize(fs: FileSystem, callback: ReturnCallback<any>): void {
        callback(undefined, {});
    }
    unserialize(serializedData: any, callback: ReturnCallback<FileSystem>): void {
        throw new Error("Method not implemented.");
    }
}
