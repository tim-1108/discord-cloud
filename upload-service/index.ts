import { ref } from "vue";
import type { UploadAbortPacket } from "../common/packet/s2u/UploadAbortPacket.js";
import type { UploadStartPacket } from "../common/packet/s2u/UploadStartPacket.js";
import { Socket } from "./Socket.js";
import type { UploadMetadata } from "../common/uploads.js";
import { GenericBooleanPacket } from "../common/packet/generic/GenericBooleanPacket.js";
import { getEnvironmentVariables } from "../common/environment.js";
import { createTimeout } from "./timeout.js";
import type { S2UPacket } from "../common/packet/S2UPacket.js";
import { UploadFinishPacket } from "../common/packet/u2s/UploadFinishPacket.js";
import { logError, logInfo } from "../common/logging.js";
import { fileTypeFromBuffer } from "file-type";
import { createHashFromBinaryLike, encryptBuffer } from "../common/crypto.js";
import { formatJSON } from "../common/useless.js";
import { Discord } from "../common/discord_new.js";
import type { DataErrorFields } from "../common/index.js";
import { combineHashes } from "./utils.js";
import { initNetwork } from "./network.js";
import { loadPackets } from "../common/packet/reader.js";

const env = getEnvironmentVariables("upload-service");
await loadPackets();
initNetwork();

/**
 * The metadata that the upload service knows about
 * via the {@link UploadStartPacket}.
 */
type UploadMetadataInService = Omit<UploadMetadata, "overwrite_target" | "overwrite_user_id" | "is_public">;
export interface Data {
    metadata: UploadMetadataInService;
    chunk_count: number;
    /**
     * Discord message IDs mapped to the indices of chunks
     */
    completed_chunks: Map<number, string>;
    /**
     * The chunk indices currently processing/uploading
     */
    processing_chunks: Set<number>;
    /**
     * The mime type of the file, determined by the first buffer
     */
    type: string;
    /**
     * The hashes of all the different buffers.
     *
     * As a string, they are concatenated at the end to then be hashed again!
     */
    hashes: string[];
    should_encrypt: boolean;
    /**
     * As uploads are only handled by one web socket at a time,
     * this is the same for every chunk running on this uploader.
     */
    channel_id: string | null;
    /**
     * A function that is called whenever a chunk is finished. Runs
     * logic for resetting the timeout or validating that the file
     * is now fully uploaded.
     */
    chunk_finish_handler: (i: number, data: Data) => void;
    /**
     * A function which clears the timeout promise (resolving it to true).
     * Used when the upload is aborted so that the timeout does not continue
     * to run despite the upload being already terminated.
     */
    promise_clear_fn: () => void;
}

const socket = new Socket();
const handle = ref<Data | null>(null);

export const Upload = {
    packet: {
        start: packet$uploadStart,
        abort: packet$uploadAbort
    },
    event: {
        submitFile: event$submitFile
    },
    data: handle,
    busy: isBusy
} as const;

function isBusy() {
    return handle.value !== null;
}

function getHandleOrThrow(): Data {
    if (handle.value === null) {
        throw new ReferenceError("Retrieving handle data in a secure context was not possible, is null");
    }
    return handle.value;
}

function createData(metadata: UploadMetadataInService, onChunkFinish: (i: number, data: Data) => void, promiseClearFn: () => void): Data {
    const cc = Math.ceil(metadata.size / metadata.chunk_size);
    return {
        metadata,
        chunk_count: cc,
        completed_chunks: new Map(),
        processing_chunks: new Set(),
        type: "application/octet-stream",
        hashes: new Array(cc),
        should_encrypt: env.ENCRYPTION === "1",
        channel_id: null,
        chunk_finish_handler: onChunkFinish,
        promise_clear_fn: promiseClearFn
    };
}

function packet$uploadStart(packet: UploadStartPacket) {
    if (isBusy()) {
        rejectPacket(packet, "The service is internally still marked as busy. The manager must not prompt to start another upload!");
        return;
    }

    // We will assume this is trustworthy, as it is sent from the manager.
    const metadata = packet.getData() as UploadMetadataInService;
    const { promise, lengthen, clear } = createTimeout();

    function onChunkFinish(i: number, data: Data) {
        if (data.completed_chunks.size < data.chunk_count) {
            lengthen();
            logInfo(`Uploaded chunk ${i}, that's now ${data.completed_chunks.size}/${data.chunk_count}`);
            return;
        }

        // This implicitly also catches empty strings
        if (!data.channel_id) {
            throw new ReferenceError("Channel id not set after uploading all chunks");
        }

        const messages = retrieveMessagesFromMap(data.completed_chunks);
        socket.sendPacket(
            new UploadFinishPacket({
                success: true,
                messages,
                hash: combineHashes(data.hashes),
                is_encrypted: data.should_encrypt,
                type: data.type,
                channel: data.channel_id as string
            })
        );

        clear();
        logInfo("Finished upload", data.metadata.path, data.metadata.name);
        handle.value = null;
    }

    handle.value = createData(metadata, onChunkFinish, clear);

    // Async worker to detect timeout expiration
    (async () => {
        const status = await promise;
        if (status /* status true is success */) {
            return;
        }
        // If handle is not set, something else must have cleared it beforehand
        // This is not behaviour we want and we need to know about it!
        if (handle.value === null) {
            logError("Handle has already been cleared before the upload could be aborted via timeout! (timeout not cleared upon success?)");
        } else {
            logInfo(`Timeout exceeded after uploading chunks: ${handle.value.completed_chunks.size}/${handle.value.chunk_count}`);
        }
        socket.sendPacket(new UploadFinishPacket({ success: false, reason: "Timeout exceeded" }));
        abortUpload();
    })();

    logInfo("Started upload:", metadata.path, metadata.name);
    socket.replyToPacket(packet, new GenericBooleanPacket({ success: true }));
}

function packet$uploadAbort(packet: UploadAbortPacket) {
    if (!isBusy()) {
        rejectPacket(packet, "The service is currently not handling any upload it can abort");
        return;
    }
    abortUpload();
    socket.replyToPacket(packet, new GenericBooleanPacket({ success: true }));
}

async function event$submitFile(buffer: Buffer, chunkId: number): Promise<DataErrorFields<boolean, string, "success">> {
    const data = getHandleOrThrow();
    data.processing_chunks.add(chunkId);
    if (chunkId === 0) {
        const type = await fileTypeFromBuffer(buffer);
        if (type) data.type = type.mime;
    }

    data.hashes[chunkId] = createHashFromBinaryLike(buffer);
    buffer = data.should_encrypt ? encryptBuffer(buffer) : buffer;
    const cfg = {
        buf: buffer,
        filename: chunkId.toString(10),
        content: "```json\n" + formatJSON(data.metadata) + "\n```"
    };

    const response = await Discord.bot.sendMessage(env.CHANNEL_ID, cfg);
    if (!response.data) {
        data.processing_chunks.delete(chunkId);
        logError(`Failed to upload chunk ${chunkId}: ${response.error}`);
        return { success: null, error: `Failed to upload to Discord: ${response.error}` };
    }
    const msg = response.data;

    data.completed_chunks.set(chunkId, msg.id);
    data.processing_chunks.delete(chunkId);
    // This is only truly necessary on the first chunk uploaded.
    // We cannot however just do "chunkId === 0", as chunks may
    // be uploaded in any order by the user.
    data.channel_id = msg.channel_id;
    data.chunk_finish_handler(chunkId, data);
    return { success: true, error: null };
}

function rejectPacket(packet: S2UPacket, message?: string) {
    return socket.replyToPacket(packet, new GenericBooleanPacket({ success: false, message }));
}

// This function does not send anything to the manager as there
// are two routes in which this function is called:
// - manager requested abort -> expects boolean response
// - timeout exceeded, server listens for UploadFinishPackets with success = false
function abortUpload() {
    if (!handle.value) {
        logError("Called abortUpload when there was not even a upload set");
        return;
    }
    logInfo("Upload aborted:", handle.value.metadata.path, handle.value.metadata.name);
    handle.value.promise_clear_fn();
    handle.value = null;
}

// We cannnot be sure that just converting the map's values
// into an array will retrieve them in the correct order (by index)
// as the user may submit them in any order.
function retrieveMessagesFromMap(map: Map<number, string>): string[] {
    const arr = new Array<string>(map.size);
    const iterator = map.entries();
    // polyfill for Iterator.prototype.forEach (node > 22)
    (typeof iterator.forEach === "function" ? iterator : Array.from(iterator)).forEach(([index, msg]) => (arr[index] = msg));
    return arr;
}
