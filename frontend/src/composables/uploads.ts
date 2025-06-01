import { communicator } from "@/main";
import { UploadQueueAddPacket } from "../../../common/packet/c2s/UploadQueueAddPacket";
import type { UUID } from "../../../common";
import { combinePaths, convertRouteToPath, useCurrentRoute } from "./path";
import { UploadQueueingPacket } from "../../../common/packet/s2c/UploadQueueingPacket";
import type { UploadQueueUpdatePacket } from "../../../common/packet/s2c/UploadQueueUpdatePacket";
import type { UploadStartInfoPacket } from "../../../common/packet/s2c/UploadStartInfoPacket";
import { logError, logWarn } from "../../../common/logging";

export interface UploadFileHandle {
    handle: File;
    relativePath: string;
}

function streamFromFile(file: File, chunkSize: number) {
    let buffer = new Uint8Array();
    const stream = file.stream();
    const reader = stream.getReader();

    async function readNextChunk(): Promise<{ data: Uint8Array<ArrayBuffer>; done: boolean }> {
        if (buffer.byteLength >= chunkSize) {
            const data = buffer.subarray(0, chunkSize);
            buffer = buffer.subarray(chunkSize);
            return { data, done: false };
        }

        while (true) {
            const { value, done } = await reader.read();

            if (done) {
                // if done, there is no value
                const data = buffer.subarray(0, chunkSize);
                // If we get unlucky, the last chunk of our stream sits between
                // the second to last upload chunk and the remainder.
                if (buffer.byteLength > chunkSize) {
                    buffer = buffer.subarray(chunkSize);
                    return { data, done: false };
                }
                // once we're actually done, we clear all data
                // so - if this gets called accidentially again - the data is not returned twice
                // (this oughn't happen though)
                buffer = new Uint8Array();
                return { data, done: true };
            }

            const newBuffer = new Uint8Array(buffer.byteLength + value.byteLength);
            newBuffer.set(buffer, 0);
            newBuffer.set(value, buffer.byteLength);
            buffer = newBuffer;

            if (buffer.byteLength >= chunkSize) {
                const data = buffer.subarray(0, chunkSize);
                buffer = buffer.subarray(chunkSize);
                return { data, done: false };
            }
        }
    }

    return readNextChunk;
}

async function submitUpload({ handle, relativePath }: UploadFileHandle): Promise<UUID | null> {
    const path = convertRouteToPath(useCurrentRoute().value);
    const absPath = combinePaths(path, relativePath);
    const status = await communicator.sendPacketAndReply(
        // TODO: allow public to be turned on/off
        new UploadQueueAddPacket({ name: handle.name, path: absPath, size: handle.size, is_public: false }),
        UploadQueueingPacket
    );
    if (status === null) {
        return null;
    }
    const { queue_position, upload_id } = status.getData();
    queue.set(upload_id as UUID, { path: absPath, file: handle, queue_position });
    return upload_id as UUID;
}

function advanceQueue(packet: UploadQueueUpdatePacket) {
    // TODO: make more efficient by also mapping by queue position?
    const { decrease_at, decrease_by } = packet.getData();
    for (const handle of queue.values()) {
        if (decrease_at > handle.queue_position) {
            continue;
        }
        handle.queue_position -= decrease_by;
    }
}

async function startUpload(packet: UploadStartInfoPacket) {
    const { upload_id, chunk_size, address } = packet.getData();
    const id = upload_id as UUID;
    const handle = queue.get(id);
    if (!handle) {
        logWarn("Received a start packet for an unknown upload:", packet.getData());
        return;
    }
    void queue.delete(id);
    const streamFn = streamFromFile(handle.file, chunk_size);
    const cc = Math.ceil(chunk_size / handle.file.size);
    for (let i = 0; i < cc; i++) {
        const buffer = await streamFn();
        if (i === cc - 1 && !buffer.done) {
            logError(`Not done reading from file stream despite chunks being finished`);
            break;
        }
        const cfg = { uploadId: id, targetAddress: address, chunkIndex: i, dataBuffer: buffer.data };
        const result = await sendChunk(cfg);
        // TODO: Implement retry system, we'll just move on for now
        if (!result) {
            logError("Failed to upload chunk", i, "for upload", handle);
            continue;
        }
    }
}

interface SendConfig {
    uploadId: UUID;
    targetAddress: string;
    chunkIndex: number;
    dataBuffer: Uint8Array<ArrayBuffer>;
}
function sendChunk(cfg: SendConfig) {
    return new Promise<boolean>((resolve) => {
        const form = new FormData();
        form.append("id", cfg.uploadId);
        form.append("chunk", cfg.chunkIndex.toString());
        form.append("file", new Blob([cfg.dataBuffer]));

        const xhr = new XMLHttpRequest();
        xhr.open("POST", cfg.targetAddress);
        xhr.upload.addEventListener("progress", ({ loaded, total, lengthComputable }) => {});

        xhr.onload = () => {
            resolve(xhr.status === 200);
        };

        xhr.onerror = () => {
            resolve(false);
        };

        xhr.onabort = () => {
            resolve(false);
        };

        xhr.send(form);
    });
}

interface UploadQueueHandle {
    path: string;
    file: File;
    queue_position: number;
}

const queue = new Map<UUID, UploadQueueHandle>();

export const Uploads = {
    submit: submitUpload,
    start: startUpload,
    queue: {
        advance: advanceQueue
    }
} as const;
