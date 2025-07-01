import { UploadQueueAddPacket } from "../../../common/packet/c2s/UploadQueueAddPacket";
import type { UUID } from "../../../common";
import { combinePaths, convertPathToRoute, convertRouteToPath, useCurrentRoute } from "./path";
import { UploadQueueingPacket } from "../../../common/packet/s2c/UploadQueueingPacket";
import type { UploadQueueUpdatePacket } from "../../../common/packet/s2c/UploadQueueUpdatePacket";
import type { UploadStartInfoPacket } from "../../../common/packet/s2c/UploadStartInfoPacket";
import { logError, logWarn } from "../../../common/logging";
import { computed, reactive, ref } from "vue";
import { getOrCreateCommunicator } from "./authentication";

export interface UploadFileHandle {
    handle: File;
    relativePath: string;
}

function streamFromFile(file: File, chunkSize: number) {
    /**
     * A buffer in which we write the data we have read from the stream.
     * If the buffer size exceeds the
     */
    let buffer = new Uint8Array();
    let remainder = file.size;
    const stream = file.stream();
    const reader = stream.getReader();

    /**
     * Returns the next chunk with the previously inputted {@link chunkSize} or the remainder.
     * If done, no value is returned anymore. "done: true" is only emitted after the final
     * chunk has been read (similar to using a ReadableStreamReader)
     */
    async function readNextChunk(): Promise<{ value: Uint8Array<ArrayBuffer>; done: false } | { value?: Uint8Array<ArrayBuffer>; done: true }> {
        remainder = remainder - chunkSize;
        // There is already enough data stored within the buffer,
        // we can just return the asked for amount from there.
        if (buffer.byteLength >= chunkSize) {
            const value = buffer.subarray(0, chunkSize);
            buffer = buffer.subarray(chunkSize);
            return { value, done: false };
        }

        while (true) {
            const { value, done } = await reader.read();

            if (done) {
                // if done, there is no value
                // thus, we just take everything we have stored
                const value = buffer.subarray(0, chunkSize);
                // If we get unlucky, the last chunk of our stream.read sits between
                // the second to last upload chunk and the remainder.
                // In such a case, this function will get called again for
                // the final chunk and then all the remainder will be returned

                if (remainder <= 0) {
                    // The last chunk typically is not as long as the default chunk length,
                    // thus the remainder variable will be less than 0.
                    buffer = buffer.subarray(value.length);
                    return { value, done: false };
                }
                // once we're actually done, we clear all data
                // so - if this gets called accidentially again - the data is not returned twice
                // (this oughn't happen though)
                buffer = new Uint8Array();
                return { value: undefined, done: true };
            }

            const newBuffer = new Uint8Array(buffer.byteLength + value.byteLength);
            // appending both buffers
            newBuffer.set(buffer, 0);
            newBuffer.set(value, buffer.byteLength);
            buffer = newBuffer;

            // We have just read a chunk from the stream and all the accumulated
            // data is enough to return a finished chunk!
            if (buffer.byteLength >= chunkSize) {
                const value = buffer.subarray(0, chunkSize);
                buffer = buffer.subarray(chunkSize);
                return { value, done: false };
            }
        }
    }

    return readNextChunk;
}

interface ActiveUpload {
    targetAddress: string;
    file: File;
    id: UUID;
    chunks: number;
    processed_chunks: number;
    /**
     * A value ranging from 0 to 1 describing the total
     * upload progress on the file.
     */
    progress: number;
    path: string;
}
const activeUploads = reactive(new Map<UUID, ActiveUpload>());

async function submitUpload({ handle, relativePath }: UploadFileHandle): Promise<UUID | null> {
    // For now, empty files cannot be accepted
    if (handle.size === 0) {
        return null;
    }
    const path = convertRouteToPath(useCurrentRoute().value);
    const absPath = combinePaths(path, relativePath);
    const c = await getOrCreateCommunicator();
    const status = await c.sendPacketAndReply(
        // TODO: allow public to be turned on/off
        new UploadQueueAddPacket({ name: handle.name, path: absPath, size: handle.size, is_public: true }),
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
    const cc = Math.ceil(handle.file.size / chunk_size);

    const au: ActiveUpload = {
        id: upload_id as UUID,
        targetAddress: address,
        chunks: cc,
        processed_chunks: 0,
        progress: 0,
        file: handle.file,
        path: handle.path
    };
    activeUploads.set(upload_id as UUID, au);

    for (let i = 0; i < cc; i++) {
        const buffer = await streamFn();
        if (buffer.done) {
            logError(`Stream reported done despite chunks still remaining`);
            break;
        }
        const cfg = { uploadId: id, targetAddress: address, chunkIndex: i, dataBuffer: buffer.value };
        const result = await sendChunk(cfg);
        au.processed_chunks++;
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
        // TODO: speed measurement and progress indicator
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

const queue = reactive(new Map<UUID, UploadQueueHandle>());

// === preview section ===
type PreviewItem = { files: Map<string, UploadFileHandle>; subfolders: Map<string, PreviewItem> };
function createPreviewItem(): PreviewItem {
    return { files: new Map(), subfolders: new Map() };
}
let previews = ref(createPreviewItem());
const previewTotal = ref(0);
function addPreviews(list: UploadFileHandle[]): void {
    for (const h of list) {
        const r = convertPathToRoute(h.relativePath);
        let parent = previews.value;
        for (let i = 0; i < r.length; i++) {
            const n = r[i];
            let child = parent.subfolders.get(n);
            if (!child) {
                child = createPreviewItem();
                parent.subfolders.set(n, child);
            }
            parent = child;
        }
        // This file will not be added
        // TODO: Should we overwrite it instead?
        //       Ask for user confirmation Promise?
        if (parent.files.has(h.handle.name)) {
            continue;
        }
        parent.files.set(h.handle.name, h);
        previewTotal.value++;
    }
}

function getPreviewsForRoute(route: string[]): PreviewItem | null {
    let parent = previews.value;
    for (let i = 0; i < route.length; i++) {
        const n = route[i];
        let child = parent.subfolders.get(n);
        if (!child) {
            return null;
        }
        parent = child;
    }
    return parent;
}

function getAllPreviewsAndReset() {
    // We trust our count variable here
    const a = new Array<UploadFileHandle>(previewTotal.value);
    if (!previewTotal.value) {
        return a;
    }

    const scheduledRoutes = new Array<string[]>([] /* make sure root is in there */);
    while (scheduledRoutes.length) {
        const route = scheduledRoutes[0];
        scheduledRoutes.splice(0, 1);
        const item = getPreviewsForRoute(route);
        if (!item) {
            logWarn("No preview log despite having key for route:", route);
            continue;
        }
        a.push(...Array.from(item.files.values()));
        // appending the subfolder names to the active route (without modifying the original array handle)
        const routes = Array.from(item.subfolders.keys()).map((name) => route.concat([name]));
        scheduledRoutes.push(...routes);
    }

    resetPreviews();
    return a;
}

function resetPreviews() {
    previews.value = createPreviewItem();
    previewTotal.value = 0;
}

export const Uploads = {
    submit: submitUpload,
    start: startUpload,
    active: activeUploads,
    preview: {
        add: addPreviews,
        getForRoute: getPreviewsForRoute,
        getAllAndReset: getAllPreviewsAndReset,
        count: previewTotal,
        reset: resetPreviews
    },
    queue: {
        advance: advanceQueue,
        count: computed(() => queue.size)
    }
} as const;
