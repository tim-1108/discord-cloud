import type { CreateFolderPacket } from "../../common/packet/c2s/CreateFolderPacket.js";
import type { DeleteFilePacket } from "../../common/packet/c2s/DeleteFilePacket.js";
import type { DeleteFolderPacket } from "../../common/packet/c2s/DeleteFolderPacket.js";
import type { EmptyFileUploadPacket } from "../../common/packet/c2s/EmptyFileUploadPacket.js";
import type { MoveFilesPacket } from "../../common/packet/c2s/MoveFilesPacket.js";
import type { RenameFilePacket } from "../../common/packet/c2s/RenameFilePacket.js";
import type { RenameFolderPacket } from "../../common/packet/c2s/RenameFolderPacket.js";
import { GenericBooleanPacket } from "../../common/packet/generic/GenericBooleanPacket.js";
import { patterns } from "../../common/patterns.js";
import { Authentication } from "../authentication.js";
import type { Client } from "../client/Client.js";
import { Database } from "../database/index.js";
import { Replacement } from "../replacement.js";

export const ActionClientOperations = { createFolder, moveFiles, deleteFile, renameFolder, renameFile, deleteFolder } as const;

async function createFolder(c: Client, p: CreateFolderPacket): Promise<void> {
    const d = p.getData();
    const id = await Database.folderId.getOrCreate(d.path);
    // Of course, the user may send a packet which attempts to create the root
    // folder. This is no issue as the function above will just return that folder.
    // Still, we'd count it as a failure.
    if (id === null || id === Database.root) {
        c.replyToPacket(p, new GenericBooleanPacket({ success: false }));
        return;
    }
    // The client will get notified of the new folder anyhow.
    c.replyToPacket(p, new GenericBooleanPacket({ success: true }));
}

async function moveFiles(c: Client, p: MoveFilesPacket): Promise<void> {
    const data = p.getData();

    if (data.source_id === data.target_id) {
        return;
    }
    const sf = data.source_id ?? Database.root;
    const tf = data.target_id ?? Database.root;

    for (const name of data.files) {
        if (!patterns.fileName.test(name)) continue;
        const handle = await Database.file.get(sf, name);
        if (!handle) continue;
        const ownership = await Authentication.ownership(c.getUserId(), handle);
        if (!ownership || ownership.can !== "rw") {
            continue;
        }

        const existingHandle = await Database.file.get(tf, name);
        const targetName = existingHandle ? await Replacement.file(name, tf) : name;
        // A new name just could not be found...
        if (targetName === null) {
            continue;
        }

        const result = await Database.file.update(handle.id, { name: targetName, folder: tf === "root" ? null : tf });
        // TODO: Tell the client what files have actually been moved...
        //       It is indirectly notified via file-modify packet.
    }
    c.replyToPacket(p, new GenericBooleanPacket({ success: true }));
}

async function deleteFile(c: Client, p: DeleteFilePacket) {
    const { folder_id, name } = p.getData();
    const handle = await Database.file.get(folder_id, name);

    if (!handle) {
        c.replyToPacket(p, new GenericBooleanPacket({ success: false, message: "The file does not exist" }));
        return;
    }
    const ownership = await Authentication.ownership(c.getUserId(), handle);
    if (!ownership || ownership.can !== "rw") {
        c.replyToPacket(p, new GenericBooleanPacket({ success: false, message: "Missing permission to delete the file" }));
        return;
    }
    // Although we reply here, we would not really need to.
    // The actual file-modify packet handles the update.
    const success = await Database.file.delete(handle.id);
    c.replyToPacket(p, new GenericBooleanPacket({ success }));
}

async function renameFolder(c: Client, p: RenameFolderPacket) {
    const data = p.getData();
    const id = Database.folderId.get(data.path);
    if (id === null || id === "root") return;
    const result = await Database.folder.rename(id, data.target_name);
}

async function renameFile(c: Client, p: RenameFilePacket) {
    const { path, name, target_name } = p.getData();
    if (name === target_name) {
        return;
    }
    const handle = await Database.file.get(path, name);
    if (!handle) {
        return;
    }
    const ownership = await Authentication.ownership(c.getUserId(), handle);
    if (!ownership || ownership.can !== "rw") {
        return;
    }
    const result = await Database.file.rename(handle.id, target_name);
}

async function deleteFolder(c: Client, p: DeleteFolderPacket) {}

async function uploadEmptyFile(c: Client, p: EmptyFileUploadPacket) {
    const { path, name } = p.getData();
    const folder = await Database.folderId.getOrCreate(path);
    if (folder === null) {
        return;
    }
    const existingFile = await Database.file.get(folder, name);
    const targetName = existingFile ? await Replacement.file(name, folder) : name;
    if (targetName === null) {
        return;
    }
    // TODO: How should an empty file be handled (no messages and no channel id?)
}
