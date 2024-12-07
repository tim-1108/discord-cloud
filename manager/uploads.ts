import type { UploadQueueAddPacket } from "../common/packet/c2s/UploadQueueAddPacket";
import { findRandomUploadService, getUploadServiceCount } from "./services/list";
import { Client } from "./Client";
import type { UploadMetadata } from "../common/uploads";
import type { UUID } from "../common";
import { UploadQueueUpdatePacket } from "../common/packet/s2c/UploadQueueUpdatePacket";
import { UploadQueueingPacket } from "../common/packet/s2c/UploadQueueingPacket";
import { UploadFinishInfoPacket } from "../common/packet/s2c/UploadFinishInfoPacket";
import { addFileToDatabase } from "./database/creating";

const uploadQueue = new Array<UploadMetadata>();

export function enqueueUpload(client: Client, packet: UploadQueueAddPacket) {
    const data = packet.getData();
    if (!data) return;

    // TODO: Overwriting checks (does file already exist in DB?)

    const { name, path, size } = data;

    // The only place where we first assign the id for the upload
    // This is used everywhere later on!
    const uploadUUID = crypto.randomUUID();
    uploadQueue.push({ upload_id: uploadUUID, client: client.getUUID(), name, path, size });
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
        indices.splice(index, 1);
    }
}

export async function finishUpload(metadata: UploadMetadata, messages: string[], isEncrypted: boolean, hash: string, type: string) {
    const client = Client.getClientById(metadata.client);
    if (!client) return;

    console.info("[Upload] Finish!");

    const fileHandle = await addFileToDatabase(metadata, hash, type, isEncrypted, messages);
    if (!fileHandle) {
        failUpload(metadata, "Failed to save metadata to database");
        return;
    }
    void client.sendPacket(new UploadFinishInfoPacket({ success: true, upload_id: metadata.upload_id, reason: undefined }));
    void sendUploadsToServices();
}

export function failUpload(metadata: UploadMetadata, reason?: string) {
    const client = Client.getClientById(metadata.client);
    if (!client) return;
    console.info("[Upload] Fail!", reason);
    void client.sendPacket(new UploadFinishInfoPacket({ success: false, upload_id: metadata.upload_id, reason }));
    void sendUploadsToServices();
}
