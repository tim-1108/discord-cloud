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
import { logDebug } from "../common/logging.js";
import { ClientList } from "./client/list.js";
import { ServiceRegistry } from "./services/list.js";
import { Database } from "./database/index.js";
import { ROOT_FOLDER_ID } from "./database/core.js";
import { UploadStartInfoPacket } from "../common/packet/s2c/UploadStartInfoPacket.js";
import type { FileHandle } from "../common/supabase.js";
import { Authentication } from "./authentication.js";

// With the current design, we keep no list of uploads currently in process

const uploadQueue = new Array<UploadMetadata>();
const Constants = {
    /**
     * Discord currently allows 10MB uploads per message-
     * Accordingly, we split the file into chunks of this size.
     *
     * However, as this is the size the client sends us, we have
     * to allow for some padding for the IV and AES chunks.
     * Note that 1kb is most likely too large, but this does
     * not have any real impact.
     */
    chunkSize: 10 * 1024 * 1024 - 1024
};

export const Uploads = {
    enqueue: performEnqueueUploadOperation,
    pushToServices,
    clear: {
        indices: removeIndicesFromQueue,
        client: removeClientItemsFromQueue
    },
    fail: failUpload,
    finish: finishUpload
} as const;

async function performEnqueueUploadOperation(client: Client, packet: UploadQueueAddPacket) {
    const { name, path, size, is_public } = packet.getData();

    const existingFile = await Database.file.getWithPath(name, path);
    let userId: number | null = null;
    if (existingFile !== null) {
        // There may be an infinite number of uploads trying to overwrite a file
        // (they will be processed one after the other)
        // That poses no risk as they just UPDATE the db entry

        // TODO: ask user if they really wish to overwrite?
        //       only maybe though.
        //       For that, implement another packet sent to the client asking
        //       If they do not respond, assuming cancelling?

        const ownership = await Authentication.permissions.ownership(client.getUserId(), existingFile);
        // 1) Public files may be overwritten by anyone. The owner is kept though.
        // 2) If the user is only receiving the file via a share, they may only
        //    overwrite it when can_write is true. The owner is kept as well.
        // TODO: implement this same check when actually writing to db?
        //       the owner might have changed permissions since then (although unlikely)
        if (ownership === null || ownership.status === "restricted" || (ownership.status === "shared" && !ownership.share.can_write)) {
            return;
        }

        userId = existingFile.owner;
    }

    // The only place where we first assign the id for the upload
    // This is used everywhere later on!
    const uploadUUID = crypto.randomUUID();
    const chunkSize = Math.min(Constants.chunkSize, size);

    const item = {
        upload_id: uploadUUID,
        name,
        path,
        size,
        chunk_size: chunkSize
    };

    const pos =
        uploadQueue.push({
            ...item,
            client: client.getUUID(),
            overwrite_target: existingFile?.id ?? null,
            overwrite_user_id: userId,
            is_public
        }) - 1;
    const pkt = new UploadQueueingPacket({ ...item, queue_position: pos });
    client.replyToPacket(packet, pkt);
    void pushToServices(true);
}

async function pushToServices(isFromQueueAdd?: boolean): Promise<void> {
    // How many uploads have been submitted in this cycle
    let c = 0;

    while (uploadQueue.length > 0) {
        const s = ServiceRegistry.random.idle("upload");
        // We are done for now, there is no other available uploader
        if (!s) break;

        const meta = uploadQueue.shift();
        // The queue just happens to be empty
        if (!meta) break;

        const status = await s.requestUploadStart(meta);
        // Now, this really should only happen in weird circumstances
        if (status !== null) {
            // Can we even send a upload fail packet when nothing has even happend yet?
            failUpload(meta, status);
            continue;
        }
        const client = ClientList.get(meta.client);
        if (!client) {
            failUpload(meta, "Client disconnected");
            continue;
        }

        const { chunk_size, upload_id } = meta;
        client.sendPacket(new UploadStartInfoPacket({ chunk_size, upload_id, address: s.getAddress() })), c++;
    }

    logDebug("Pushed", c, "jobs to upload services");

    // In the queue add process, nothing should change, so nobody needs to be notified.
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

function removeClientItemsFromQueue(clientId: UUID) {
    let count = 0;
    for (let i = uploadQueue.length - 1; i >= 0; i--) {
        const item = uploadQueue[i];
        if (item.client !== clientId) {
            continue;
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
        uploadQueue.splice(index, 1);
    }
}

async function finishUpload(metadata: UploadMetadata, packet: UploadFinishPacket) {
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

    // It may also be that the file, if overwritten, had no user assigned to it.
    // If so, we assign it to them here.
    const user = await Database.user.get(metadata.overwrite_user_id ?? client.getUserId());
    if (!user) {
        failUpload(metadata, "Owner of the file no longer exists");
        return;
    }

    const handle: Omit<FileHandle, "id" | "created_at" | "updated_at"> = {
        name,
        size,
        folder: folderId === ROOT_FOLDER_ID ? null : folderId,
        is_encrypted: data.is_encrypted ?? false,
        hash: data.hash,
        type: data.type,
        channel: data.channel,
        // TODO: See UploadFinishPacket's code for safe re-implemntation idea
        messages: data.messages ?? [],
        // Even when overwriting, this should be false
        has_thumbnail: false,
        is_public: metadata.is_public,
        owner: user.id
    };

    void client.sendPacket(new UploadFinishInfoPacket({ success: true, upload_id: metadata.upload_id, reason: undefined }));
    void pushToServices();

    let $handle: FileHandle | null;
    if (metadata.overwrite_target !== null) {
        const d = new Date();
        $handle = await Database.file.update(metadata.overwrite_target, { ...handle, updated_at: d.toUTCString() });
        if ($handle === null) {
            // The file might have been the deleted in the meantime
            // We cannot really prevent that, as dropping folders also
            // cascades in file deletions (too complicated)
            failUpload(metadata, "Failed to overwrite file");
            return;
        }
        void Database.thumbnail.delete(metadata.overwrite_target);
    } else {
        $handle = await Database.file.add(handle);
        if ($handle === null) {
            failUpload(metadata, "Failed to insert file into database");
            return;
        }
    }

    // Next, we contact our thumbnail service to have a screenshot generated
    // We will not be waiting here for a response, as that might get queued
    // up or take a long time. Thus, the packet receiver will handle that.
    if (!ThumbnailService.shouldGenerateThumbnail($handle.type)) return;
    const tService = ServiceRegistry.random.all("thumbnail");
    const t = { messages: $handle.messages, type: $handle.type, channel: $handle.channel };
    if (!tService) {
        ThumbnailService.enqueueFile($handle.id, t);
        return;
    }
    tService.sendPacket(new GenThumbnailPacket({ ...t, id: $handle.id }));
}

function failUpload(metadata: UploadMetadata, reason?: string) {
    const client = ClientList.get(metadata.client);
    if (!client) return;
    logDebug("Failed upload for", metadata);
    void client.sendPacket(new UploadFinishInfoPacket({ success: false, upload_id: metadata.upload_id, reason }));
    void pushToServices();
}
