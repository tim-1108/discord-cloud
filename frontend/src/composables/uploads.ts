import type { UUID } from "../../../common";
import { attemptRepairFolderOrFileName, combinePaths, convertPathToRoute, convertRouteToPath, useCurrentRoute } from "./path";
import { logError, logWarn } from "../../../common/logging";
import { computed, reactive, ref, shallowReactive, toRaw, watch, type Reactive, type Ref } from "vue";
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
import { UploadAbortRequestPacket } from "../../../common/packet/c2s/UploadAbortRequestPacket";

export interface UploadRelativeFileHandle {
    file: File;
    relativePath: string;
}
interface UploadAbsoluteFileHandle {
    file: File;
    path: string;
}

const SERVER_INITIATED_ABORT = 0x01 as const;
const USER_INITIATED_ABORT = 0x02 as const;
const CONNECTION_ABORT = 0x03 as const;

const activeUploads = reactive(new Map<UUID, ActiveUpload>());
const queue = reactive(new Array<UploadAbsoluteFileHandle>());

const desiredUploaderCount = ref(10);
const availableUploaderCount = ref(0);
watch(desiredUploaderCount, (value) => {
    // If we are not activly handling any uploads, we do not need
    // to book the uploaders the user desires to have when they change the count.
    const isHandlingUploads = queue.length > 0 || activeUploads.size > 0;
    if (value === 0 || isHandlingUploads) return;
    void bookUploaders(value);
});

async function bookUploaders(desiredAmount: number) {
    const com = await getOrCreateCommunicator();
    const reply = await com.sendPacketAndReply_new(new UploadServicesRequestPacket({ desired_amount: desiredAmount }), UploadServicesPacket);
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

async function trigger_servicesRelease() {
    if (queue.length || activeUploads.size) return;
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
}

function handleBookingModification(packet: UploadBookingModifyPacket) {
    const { effective_change } = packet.getData();
    if (availableUploaderCount.value + effective_change < 0) {
        logError(
            "Received an invalid effective change that would result in a negative value. eff:",
            effective_change,
            " | current:",
            availableUploaderCount.value
        );
        return;
    }
    availableUploaderCount.value += effective_change;
}

function streamFromFile(file: File, chunkSize: number, abortController?: AbortController) {
    /**
     * A buffer in which we write the data we have read from the stream.
     * If the buffer size exceeds the
     */
    let buffer = new Uint8Array();
    let remainder = file.size;
    const stream = file.stream();
    const reader = stream.getReader();

    const signal = abortController?.signal;

    /**
     * Returns the next chunk with the previously inputted {@link chunkSize} or the remainder.
     * If done, no value is returned anymore. "done: true" is only emitted after the final
     * chunk has been read (similar to using a ReadableStreamReader)
     */
    async function readNextChunk(): Promise<{ value: Uint8Array<ArrayBuffer>; done: false } | { value: undefined; done: true }> {
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
            // If we actually just aborted this thing, we might as well
            // just stop now instead of building the whole buffer. The
            // caller will not do anything with this buffer anyhow.
            // This is only done here as all other operations occurr sync.
            if (signal?.aborted) return { value: undefined, done: true };

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
    target_address: string;
    file: File;
    id: UUID;
    chunks: number;
    processed_chunks: Ref<number>;
    /**
     * A value ranging from 0 to 1 describing the total
     * upload progress on the file.
     */
    progress: Ref<number>;
    name: string;
    path: string;
    /**
     * Used to calculate the speed of the upload
     */
    start_timestamp: number;
    /**
     * Upload speed in bytes/sec
     */
    speed: Ref<number>;
    abort_controller?: AbortController;
}

function submitUpload({ file, relativePath }: UploadRelativeFileHandle): number | null {
    // For now, empty files cannot be accepted
    // They will be uploaded using a special packet
    if (file.size === 0) {
        return null;
    }
    const currentPath = convertRouteToPath(useCurrentRoute().value);
    const absPath = combinePaths(currentPath, relativePath);

    // Thus only triggered if this is the first upload we are doing again
    if (!queue.length && !activeUploads.size) {
        bookUploaders(desiredUploaderCount.value);
    }

    return queue.push({ file, path: absPath });
}

async function startNextUpload() {
    const handle = queue.shift();
    if (!handle) {
        return;
    }

    // If we are not presently connected to anything, this will
    // halt execution of the function until we are.
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

    const abortController = new AbortController();
    const { signal } = abortController;

    const streamFn = streamFromFile(handle.file, chunk_size, abortController);
    const cc = Math.ceil(handle.file.size / chunk_size);

    const au: ActiveUpload = {
        id: upload_id as UUID,
        target_address: uploadAddress,
        chunks: cc,
        processed_chunks: ref(0),
        /**
         * The amount of bytes already sent
         */
        progress: ref(0),
        file: handle.file,
        name: rename_target ?? handle.file.name,
        path: handle.path,
        start_timestamp: performance.now(),
        speed: ref(0),
        abort_controller: abortController
    };
    // @ts-expect-error au.processed_chunks is picked up as number when it should actually be Ref<number>??
    activeUploads.set(upload_id as UUID, au);

    let lastProgress = 0;
    const $i = setInterval(() => {
        if (signal.aborted) {
            clearInterval($i);
            return;
        }
        const delta = au.progress.value - lastProgress;
        lastProgress = au.progress.value;
        au.speed.value = delta / 0.5;
    }, 500);

    async function cleanup(sendAbortPacket?: boolean): Promise<void> {
        activeUploads.delete(upload_id as UUID);
        clearInterval($i);
        if (sendAbortPacket) {
            const com = await getOrCreateCommunicator();
            void com.sendPacket(new UploadAbortRequestPacket({ upload_id }));
        }
    }

    for (let i = 0; i < cc; i++) {
        // We can only load this buffer once as it comes out of a stream
        // we cannot reverse. If the upload has failed, we have to retry
        // the upload itself, but never the stream reading.
        const buffer = await streamFn();

        // This is before the buffer.done check because when the upload is
        // aborted, the stream function returns done = true regardless of
        // the actual state.
        if (signal.aborted) {
            logWarn("Aborted upload", au);
            // If the server informed us of the abort, we need not ask for one from it.
            cleanup(signal.reason !== SERVER_INITIATED_ABORT);
            return startNextUpload();
        }
        if (buffer.done) {
            // If this happend, shit has hit the fan.
            throw new Error(`Stream reported done despite chunks still remaining: ${upload_id} | Chunk: ${i}`);
        }

        const cfg = { uploadId: au.id, targetAddress: au.target_address, chunkIndex: i, dataBuffer: buffer.value };

        let attempt = 0;
        const MAX_ATTEMPTS = 10 as const;
        while (attempt++ < MAX_ATTEMPTS) {
            const result = await sendChunk(cfg, au, signal);
            if (result) {
                au.processed_chunks.value++;
                break;
            }
            logError(`(Attempt ${attempt}) Failed to upload chunk ${i} for upload`, handle);
            // There is no reason to then upload the other chunks. This file is dead.
            if (attempt === MAX_ATTEMPTS) {
                logError("Failed to upload the file after too many failed attempts to upload the chunk");
                cleanup(true);
                return startNextUpload();
            }
        }
    }
    cleanup();
    // TODO: Would this not possibly create a big big callstack? Bad!
    return startNextUpload();
}

function handleUploadFinish(packet: UploadFinishInfoPacket) {
    const { success, upload_id, reason } = packet.getData();
    const handle = activeUploads.get(upload_id as UUID);
    if (!handle) {
        logWarn("Received finish packet for unknown upload:", upload_id);
        return;
    }
    if (!success && handle.abort_controller && !handle.abort_controller?.signal.aborted) {
        handle.abort_controller.abort(SERVER_INITIATED_ABORT);
    }
    activeUploads.delete(upload_id as UUID);
    if (!success) {
        logError(`Upload failed due to ${reason ?? "unknown"}`);
        console.error(`${handle.path} | ${handle.name}`);
    }
    // TODO: Notify user if upload failed!
    void startNextUpload();
    trigger_servicesRelease();
}

interface SendConfig {
    uploadId: UUID;
    targetAddress: string;
    chunkIndex: number;
    dataBuffer: Uint8Array<ArrayBuffer>;
}
function sendChunk(cfg: SendConfig, handle: ActiveUpload, signal?: AbortSignal) {
    return new Promise<boolean>((resolve) => {
        const form = new FormData();
        form.append("id", cfg.uploadId);
        form.append("chunk", cfg.chunkIndex.toString());
        form.append("file", new Blob([cfg.dataBuffer]));

        const xhr = new XMLHttpRequest();
        xhr.open("POST", cfg.targetAddress);
        let loaded_lastValue = 0;
        xhr.upload.addEventListener("progress", ({ loaded, lengthComputable }) => {
            if (!lengthComputable) return;
            const deltaBytes = loaded - loaded_lastValue;
            loaded_lastValue = loaded;
            handle.progress.value += deltaBytes;
        });

        xhr.onload = () => {
            resolve(xhr.status === 200);
        };

        xhr.onerror = () => {
            resolve(false);
        };

        xhr.onabort = () => {
            resolve(false);
        };

        function _abort() {
            xhr.abort();
            signal?.removeEventListener("abort", _abort);
        }
        signal?.addEventListener("abort", () => _abort());

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
    queue: queue,
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

// @ts-expect-error
globalThis.Uploads = Uploads;
