import type { UploadQueueAddPacket } from "../common/packet/c2s/UploadQueueAddPacket.js";
import { findRandomUploadService, getThumbnailService, getUploadServiceCount } from "./services/list.js";
import { Client } from "./Client.js";
import type { UploadMetadata } from "../common/uploads.js";
import type { UUID } from "../common";
import { UploadQueueUpdatePacket } from "../common/packet/s2c/UploadQueueUpdatePacket.js";
import { UploadQueueingPacket } from "../common/packet/s2c/UploadQueueingPacket.js";
import { UploadFinishInfoPacket } from "../common/packet/s2c/UploadFinishInfoPacket.js";
import { addFileToDatabase } from "./database/creating.js";
import type { UploadFinishPacket } from "../common/packet/u2s/UploadFinishPacket.js";
import { ThumbnailService } from "./services/ThumbnailService.js";
import { GenThumbnailPacket } from "../common/packet/s2t/GenThumbnailPacket.js";
import { getFileFromDatabase } from "./database/finding.js";
import { deleteFileFromDatabase } from "./database/public.js";
import { logDebug, logError } from "../common/logging.js";

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
    const existingFile = await getFileFromDatabase(name, path);
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

export async function sendUploadsToServices(isInitial?: boolean, isRetry?: boolean): Promise<void> {
    const count = getUploadServiceCount();
    if (count.total === 0 || count.total === count.busy) return;
    console.info("[Submit Uploads]", uploadQueue.length, "upload(s) queued,", count.busy, "of", count.total, "uploaders busy");
    while (uploadQueue.length > 0) {
        if (count.total === count.busy) break;
        const service = findRandomUploadService();
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
            return void sendUploadsToServices(isInitial, true);
        }

        console.info("[Submit Uploads] Sent upload to service");

        // Even without re-fetching the count, we know the service will be busy.
        count.busy++;
    }
    // Initial signifies that this push comes from
    // when an upload has been first queued.
    // In this process, nothing should change, so nobody needs to be notified.
    if (isInitial) return;
    notifyClientsOfQueueMovement();
}

function notifyClientsOfQueueMovement() {
    // TODO: more intelligent notification!
    const map = new Map<UUID, { upload_id: UUID; queue_position: number }[]>();
    for (let i = 0; i < uploadQueue.length; i++) {
        const item = uploadQueue[i];
        const { client, upload_id } = item;
        const data = { upload_id, queue_position: i };
        if (!map.has(client)) {
            map.set(client, [data]);
            continue;
        }
        map.get(client)!.push(data);
    }
    for (const [clientId, items] of map) {
        const client = Client.getClientById(clientId);
        if (!client) {
            console.warn(`[Upload queue] A disconnected client (${clientId}) still had ${items.length} in queue`);
            removeIndicesFromQueue(items.map((item) => item.queue_position));
            continue;
        }
        void client.sendPacket(new UploadQueueUpdatePacket({ uploads: items }));
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
    const client = Client.getClientById(metadata.client);
    if (!client) return;

    logDebug("Finished upload for", metadata);

    const data = packet.getData();

    if (typeof data.hash !== "string" || typeof data.type !== "string" || typeof data.channel !== "string") {
        failUpload(metadata, "Invalid metadata exchange between manager and service");
        return;
    }

    const fileHandle = await addFileToDatabase(metadata, data.hash, data.type, data.is_encrypted ?? false, data.messages ?? [], data.channel);
    if (!fileHandle) {
        failUpload(metadata, "Failed to save metadata to database");
        return;
    }
    void client.sendPacket(new UploadFinishInfoPacket({ success: true, upload_id: metadata.upload_id, reason: undefined }));
    void sendUploadsToServices();

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
    const tService = getThumbnailService();
    if (!tService) {
        ThumbnailService.enqueueFile(fileHandle.id, { messages: fileHandle.messages, type: fileHandle.type, channel: fileHandle.channel });
        return;
    }
    tService.sendPacket(new GenThumbnailPacket({ id: fileHandle.id, messages: fileHandle.messages, type: fileHandle.type, channel: fileHandle.channel }));
}

export function failUpload(metadata: UploadMetadata, reason?: string) {
    const client = Client.getClientById(metadata.client);
    if (!client) return;
    if (metadata.is_overwriting_id) {
        filesToBeOverwritten.delete(metadata.is_overwriting_id);
    }
    logDebug("Failed upload for", metadata);
    void client.sendPacket(new UploadFinishInfoPacket({ success: false, upload_id: metadata.upload_id, reason }));
    void sendUploadsToServices();
}
