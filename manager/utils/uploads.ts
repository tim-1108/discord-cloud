import type { UploadQueueAddPacket } from "../../common/packet/c2s/UploadQueueAddPacket.ts";
import { findRandomUploadService, getUploadServiceCount } from "../services/list.ts";
import type { Client } from "../Client.ts";
import type { UploadMetadataClientProvided } from "../../common/uploads";

interface UploadQueueItem {
    metadata: UploadMetadataClientProvided;
    queue_position: number;
}

const uploadQueue = new Array<UploadQueueItem>();

export function enqueueUpload(client: Client, packet: UploadQueueAddPacket) {
    const data = packet.getData();
    if (!data) return;

    const { name, path, size } = data;

    uploadQueue.push({ metadata: { client: client.getUUID(), name, path, size }, queue_position: uploadQueue.length });
    void sendUploadsToServices();
}

export async function sendUploadsToServices() {
    const count = getUploadServiceCount();
    if (count.total === 0 || count.total === count.busy) return;
    console.info("[Submit Uploads]", uploadQueue.length, "upload(s) scheduled,", count.busy, "of", count.total, "uploaders busy");
    while (uploadQueue.length > 0) {
        if (count.total === count.busy) break;
        const service = findRandomUploadService();
        // This should not happen.
        if (!service) break;

        const item = uploadQueue.shift();
        if (!item) break;
        await service.requestUploadStart(item.metadata);

        // Even without re-fetching the count, we know the service will be busy.
        count.busy++;
    }
}
