import type { UploadQueueAddPacket } from "../common/packet/c2s/UploadQueueAddPacket.js";
import { Client } from "./client/Client.js";
import type { UploadMetadata } from "../common/uploads.js";
import type { UUID } from "../common";
import { UploadQueueUpdatePacket } from "../common/packet/s2c/UploadQueueUpdatePacket.js";
import { UploadQueueingPacket } from "../common/packet/s2c/UploadQueueingPacket.js";
import { UploadFinishInfoPacket } from "../common/packet/s2c/UploadFinishInfoPacket.js";
import type { UploadFinishPacket } from "../common/packet/u2s/UploadFinishPacket.js";
import { ThumbnailService } from "./services/ThumbnailService.js";
import { GenThumbnailPacket } from "../common/packet/s2t/GenThumbnailPacket.js";
import { deleteFileFromDatabase } from "./database/public.js";
import { logDebug, logError } from "../common/logging.js";
import { ClientList } from "./client/list.js";
import { ServiceRegistry } from "./services/list.js";
import { Database } from "./database/index.js";
import { ROOT_FOLDER_ID } from "./database/core.js";

const uploadQueue = new Array<UploadMetadata>();
/**
 * A set of all the files that are pending to be overwritten
 */
const filesToBeOverwritten = new Set<number>();

export async function performEnqueueUploadOperation(client: Client, packet: UploadQueueAddPacket) {
    const data = packet.getData();
    if (!data) return;

    const { name, path, size } = data;

    // Upon finishing the upload, the previous file will be removed.
    const existingFile = await Database.file.getWithPath(name, path);
    if (existingFile !== null) {
        // There may only be one upload at a time attempting to overwrite another!
        if (filesToBeOverwritten.has(existingFile.id)) {
            // TODO: notify user
            return;
        }
        filesToBeOverwritten.add(existingFile.id);
    }

    // The only place where we first assign the id for the upload
    // This is used everywhere later on!
    const uploadUUID = crypto.randomUUID();
    uploadQueue.push({ upload_id: uploadUUID, client: client.getUUID(), name, path, size, is_overwriting_id: existingFile ? existingFile.id : null });
    client.replyToPacket(packet, new UploadQueueingPacket({ upload_id: uploadUUID, queue_position: uploadQueue.length - 1, name, path, size }));
    void sendUploadsToServices();
}

export async function sendUploadsToServices(isFromQueueAdd?: boolean, isRetry?: boolean): Promise<void> {
    // How many uploads have been submitted in this cycle
    let c = 0;
    const count = ServiceRegistry.count("upload");
    if (count.total === 0 || count.idle === 0) return;
    console.info("[Submit Uploads]", uploadQueue.length, "upload(s) queued,", count.idle, "of", count.total, "uploaders idle");
    while (uploadQueue.length > 0) {
        if (count.idle === 0) break;
        const service = ServiceRegistry.random.idle("upload");
        // This should not happen.
        if (!service) break;

        const item = uploadQueue.shift();
        if (!item) break;
        const wasSuccessful = await service.requestUploadStart(item);
        if (!wasSuccessful) {
            if (item.is_overwriting_id) {
                filesToBeOverwritten.delete(item.is_overwriting_id);
            }
            if (isRetry) return;
            console.warn("[Submit Uploads] We failed to start an upload");
            // If this did not work this time, we will try again.
            return void sendUploadsToServices(isFromQueueAdd, true);
        }

        console.info("[Submit Uploads] Sent upload to service");

        // Even without re-fetching the count, we know the service will be busy.
        count.idle--;
    }
    // Initial signifies that this push comes from
    // when an upload has been first queued.
    // In this process, nothing should change, so nobody needs to be notified.
    if (isFromQueueAdd || c === 0) return;
    pushQueueUpdateToClients(0, c);
}

function pushQueueUpdateToClients(index: number, count: number) {
    // We only send the packet to all those who actually need to know
    const clients = new Set<UUID>();
    for (const item of uploadQueue) {
        clients.add(item.client);
    }
    for (const id of clients) {
        const client = ClientList.get(id);
        if (!client) {
            // Only possible to reach whenever a client disconnects and their items are
            // removed from end to front. Thus, these will still be in the array.
            continue;
        }
        client.sendPacket(new UploadQueueUpdatePacket({ decrease_at: index, decrease_by: count }));
    }
}

export function removeClientItemsFromQueue(clientId: UUID) {
    let count = 0;
    for (let i = uploadQueue.length - 1; i >= 0; i--) {
        const item = uploadQueue[i];
        if (item.client !== clientId) {
            continue;
        }
        if (item.is_overwriting_id !== null) {
            filesToBeOverwritten.delete(item.is_overwriting_id);
        }
        uploadQueue.splice(i, 1);
        pushQueueUpdateToClients(i, 1);
        count++;
    }
    return count;
}

/**
 * Takes in an array of indices from the upload queue and removes them from that list.
 * Indices can be inputted in any order.
 * @param indices
 */
function removeIndicesFromQueue(indices: number[]) {
    // The largest indices have to come first
    // Otherwise, we may remove early indices first, causing the others to be offset
    indices = indices.sort((a, b) => b - a);
    for (const index of indices) {
        const value = uploadQueue[index];
        if (value.is_overwriting_id !== null) {
            filesToBeOverwritten.delete(value.is_overwriting_id);
        }
        uploadQueue.splice(index, 1);
    }
}

export async function finishUpload(metadata: UploadMetadata, packet: UploadFinishPacket) {
    const client = ClientList.get(metadata.client);
    if (!client) return;

    logDebug("Finished upload for", metadata);

    const data = packet.getData();

    // TODO: Make channel required
    if (typeof data.hash !== "string" || typeof data.type !== "string" || typeof data.channel !== "string") {
        failUpload(metadata, "Invalid metadata exchange between manager and service");
        return;
    }

    const { name, path, size } = metadata;
    const folderId = await Database.folder.getOrCreateByPath(path);
    if (folderId === null) {
        failUpload(metadata, "Failed to create folder in database");
        return;
    }

    const fileHandle = await Database.file.add({
        name,
        size,
        folder: folderId === ROOT_FOLDER_ID ? null : folderId,
        is_encrypted: data.is_encrypted ?? false,
        hash: data.hash,
        type: data.type ?? "",
        channel: data.channel ?? "",
        messages: data.messages ?? [],
        has_thumbnail: false,
        // TODO: Make functional
        is_public: false,
        owner: client.getUserId()
    });
    if (!fileHandle) {
        failUpload(metadata, "Failed to save metadata to database");
        return;
    }
    void client.sendPacket(new UploadFinishInfoPacket({ success: true, upload_id: metadata.upload_id, reason: undefined }));
    void sendUploadsToServices();

    // TODO: Rework this system to instead update the database entry and validate ownership
    if (metadata.is_overwriting_id !== null) {
        const hasOverwritten = await deleteFileFromDatabase(metadata.is_overwriting_id);
        filesToBeOverwritten.delete(metadata.is_overwriting_id);
        if (!hasOverwritten) {
            logError("Failed to remove file to be overwritten for file", metadata);
        }
    }

    // Next, we contact our thumbnail service to have a screenshot generated
    // We will not be waiting here for a response, as that might get queued
    // up or take a long time. Thus, the packet receiver will handle that.
    const tService = ServiceRegistry.random.all("thumbnail");
    if (!tService) {
        ThumbnailService.enqueueFile(fileHandle.id, { messages: fileHandle.messages, type: fileHandle.type, channel: fileHandle.channel });
        return;
    }
    tService.sendPacket(
        new GenThumbnailPacket({ id: fileHandle.id, messages: fileHandle.messages, type: fileHandle.type, channel: fileHandle.channel })
    );
}

export function failUpload(metadata: UploadMetadata, reason?: string) {
    const client = ClientList.get(metadata.client);
    if (!client) return;
    if (metadata.is_overwriting_id) {
        filesToBeOverwritten.delete(metadata.is_overwriting_id);
    }
    logDebug("Failed upload for", metadata);
    void client.sendPacket(new UploadFinishInfoPacket({ success: false, upload_id: metadata.upload_id, reason }));
    void sendUploadsToServices();
}
