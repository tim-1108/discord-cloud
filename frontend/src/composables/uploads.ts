import type { UUID } from "../../../common";
import { attemptRepairFolderOrFileName, combinePaths, convertPathToRoute, convertRouteToPath, useCurrentRoute } from "./path";
import { logError, logWarn } from "../../../common/logging";
import { computed, reactive, ref, watch } from "vue";
import { getOrCreateCommunicator } from "./authentication";
import { UploadServicesReleasePacket } from "../../../common/packet/c2s/UploadServicesReleasePacket";
import { GenericBooleanPacket } from "../../../common/packet/generic/GenericBooleanPacket";
import { UploadServicesRequestPacket } from "../../../common/packet/c2s/UploadServicesRequestPacket";
import { UploadServicesPacket } from "../../../common/packet/s2c/UploadServicesPacket";
import { Dialogs } from "./dialog";
import type { UploadBookingModifyPacket } from "../../../common/packet/s2c/UploadBookingModifyPacket";
import { UploadRequestPacket } from "../../../common/packet/c2s/UploadRequestPacket";
import { patterns } from "../../../common/patterns";
import { UploadResponsePacket } from "../../../common/packet/s2c/UploadResponsePacket";
import type { UploadFinishInfoPacket } from "../../../common/packet/s2c/UploadFinishInfoPacket";

export interface UploadRelativeFileHandle {
    file: File;
    relativePath: string;
}
interface UploadAbsoluteFileHandle {
    file: File;
    path: string;
}

const desiredUploaderCount = ref(10);
const availableUploaderCount = ref(0);
// Whether any uploads are desired by the user.
// If not, we can release our booked services and book them
// again if needed. The server trusts clients to free up
// services when not needed.
const isHandlingUploads = computed(() => activeUploads.size > 0 || queue.length > 0);
watch(desiredUploaderCount, (value) => {
    if (value === 0 || !isHandlingUploads.value) return;
    void bookUploaders(value);
});

async function bookUploaders(desiredCount: number) {
    const com = await getOrCreateCommunicator();
    const reply = await com.sendPacketAndReply_new(
        new UploadServicesRequestPacket({ desired_amount: desiredUploaderCount.value }),
        UploadServicesPacket
    );
    if (!reply.packet) {
        Dialogs.alert({ title: "Failed to book upload services", body: "Upload services could not be booked due to: " + reply.error });
        return;
    }
    const { count } = reply.packet.getData();
    availableUploaderCount.value = count;
}

watch(availableUploaderCount, async (value, oldValue) => {
    if (value <= oldValue) return;
    const delta = value - oldValue;
    for (let i = 0; i < delta; i++) {
        await startNextUpload();
    }
});
watch(isHandlingUploads, async (value) => {
    if (value) {
        void bookUploaders(desiredUploaderCount.value);
        return;
    }
    const com = await getOrCreateCommunicator();
    const reply = await com.sendPacketAndReply_new(new UploadServicesReleasePacket({}), GenericBooleanPacket);
    if (!reply.packet) {
        throw new Error("Error upon releasing upload services: " + reply.error);
    }
    const { success, message } = reply.packet.getData();
    if (!success) {
        logError("Release failed due to: " + message);
    }
    availableUploaderCount.value = 0;
});

function handleBookingModification(packet: UploadBookingModifyPacket) {
    const { effective_change } = packet.getData();
    if (availableUploaderCount.value === 0) return;
    availableUploaderCount.value += effective_change;
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
    name: string;
    path: string;
}
const activeUploads = reactive(new Map<UUID, ActiveUpload>());
const queue = reactive(new Array<UploadAbsoluteFileHandle>());

function submitUpload({ file, relativePath }: UploadRelativeFileHandle): number | null {
    // For now, empty files cannot be accepted
    // They will be uploaded using a special packet
    if (file.size === 0) {
        return null;
    }
    const currentPath = convertRouteToPath(useCurrentRoute().value);
    const absPath = combinePaths(currentPath, relativePath);
    return queue.push({ file, path: absPath });
}

async function startNextUpload() {
    const handle = queue.shift();
    if (!handle) {
        return;
    }

    const com = await getOrCreateCommunicator();
    const name = attemptRepairFolderOrFileName(handle.file.name);
    if (!patterns.fileName.test(name)) {
        await Dialogs.alert({ body: `Invalid file name: ${handle.file.name}\nAttempted fix: ${name}\nThis did not work either. Sorry!` });
        return startNextUpload();
    }
    const reply = await com.sendPacketAndReply_new(
        new UploadRequestPacket({ name, path: handle.path, is_public: true, size: handle.file.size }),
        UploadResponsePacket
    );
    if (!reply.packet) {
        logError(handle);
        throw new Error("Error on sending a upload request: " + reply.error);
    }
    const { accepted, upload_address, chunk_size, rejection_reason, rename_target, upload_id } = reply.packet.getData();
    if (!accepted) {
        await Dialogs.alert({ body: `File ${name} at ${handle.path} was not accepted due to: ${rejection_reason ?? "unknown"}` });
        return startNextUpload();
    }

    const uploadAddress = upload_address as string;

    if (rename_target) {
        // TODO: notify user when the file name was changed!
        //       is already adjusted for display down below
    }

    const streamFn = streamFromFile(handle.file, chunk_size);
    const cc = Math.ceil(handle.file.size / chunk_size);

    const au: ActiveUpload = {
        id: upload_id as UUID,
        targetAddress: uploadAddress,
        chunks: cc,
        processed_chunks: 0,
        progress: 0,
        file: handle.file,
        name: rename_target ?? handle.file.name,
        path: handle.path
    };
    activeUploads.set(upload_id as UUID, au);

    for (let i = 0; i < cc; i++) {
        const buffer = await streamFn();
        if (buffer.done) {
            logError(`Stream reported done despite chunks still remaining`);
            break;
        }
        const cfg = { uploadId: au.id, targetAddress: au.targetAddress, chunkIndex: i, dataBuffer: buffer.value };
        const result = await sendChunk(cfg);
        au.processed_chunks++;
        // TODO: Implement retry system, we'll just move on for now
        if (!result) {
            logError("Failed to upload chunk", i, "for upload", handle);
            continue;
        }
    }
}

function handleUploadFinish(packet: UploadFinishInfoPacket) {
    const { success, upload_id, reason } = packet.getData();
    const handle = activeUploads.get(upload_id as UUID);
    if (!handle) {
        logWarn("Received finish packet for unknown upload:", upload_id);
        return;
    }
    activeUploads.delete(upload_id as UUID);
    if (!success) {
        logError(`Upload failed due to ${reason ?? "unknown"}`);
        console.error(`${handle.path} | ${handle.name}`);
    }
    // TODO: Notify user if upload failed!
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

// === preview section ===
type PreviewItem = { files: Map<string, UploadRelativeFileHandle>; subfolders: Map<string, PreviewItem> };
function createPreviewItem(): PreviewItem {
    return { files: new Map(), subfolders: new Map() };
}
let previews = ref(createPreviewItem());
const previewTotal = ref(0);
function addPreviews(list: UploadRelativeFileHandle[]): void {
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
        if (parent.files.has(h.file.name)) {
            continue;
        }
        parent.files.set(h.file.name, h);
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
    const a = new Array<UploadRelativeFileHandle>(previewTotal.value);
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
    start: startNextUpload,
    active: activeUploads,
    preview: {
        add: addPreviews,
        getForRoute: getPreviewsForRoute,
        getAllAndReset: getAllPreviewsAndReset,
        count: previewTotal,
        reset: resetPreviews
    },
    booking: {
        desired: desiredUploaderCount,
        available: availableUploaderCount
    },
    packets: {
        bookingModify: handleBookingModification,
        uploadFinish: handleUploadFinish
    }
} as const;
