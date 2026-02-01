import type { ResolveFunction, UUID } from "../../../common";
import { attemptRepairFolderOrFileName, combinePaths, convertPathToRoute, convertRouteToPath, useCurrentRoute } from "./path";
import { logDebug, logError, logWarn } from "../../../common/logging";
import { reactive, ref, watch, type Ref } from "vue";
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
import { createResolveFunction, formatByteString } from "../../../common/useless";
import { streamFromFile, type StreamFromFileReturn } from "./stream-from-file";

export interface UploadRelativeFileHandle {
    file: File;
    relativePath: string;
}
interface UploadAbsoluteFileHandle {
    file: File;
    path: string;
}

const Constants = {
    /**
     * This amount exists in order to not overwhelm the upload
     * service with too many concurrent chunks at once.
     */
    maxConcurrentChunks: 5,
    maxRetriesForChunkUpload: 10,
    speedCalculationIntervalMs: 500
} as const;

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
        checkInQueueAndStart();
    }
});

/**
 * Releases the booked services, but only if nothing is presently within the queue.
 */
async function releaseServicesIfDone() {
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

interface ActiveUpload {
    target_address: string;
    file: File;
    id: UUID;
    chunks: number;
    processed_chunks: Ref<number>;
    /**
     * The amount of bytes already transferred. A percentage may be
     * calculated by dividing this number by the `size` field of the file object.
     */
    processed_bytes: Ref<number>;
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

function checkInQueueAndStart() {
    if (activeUploads.size === availableUploaderCount.value) {
        return;
    }
    const handle = queue.shift();
    if (!handle) {
        return;
    }
    upload(handle);
}

type SendChunkStatus = { success: true } | { success: false; sendAbortPacket: boolean };

/**
 * The main function for handling an upload. Expects that a service was already booked
 * before being called. This function creates the stream function to read from the file
 * and controls the sending of chunks. For the actual chunk sending, it calls into
 * {@link prepareAndRetryChunk}, which finally calls {@link sendChunk}, which handles
 * the actual XHR. In here, concurrency and failure handling is implemented for chunks.
 *
 * This function **does not** handle the queue or sending the next file. Nor does it handle
 * the releasing of services. All that is only done when the {@link UploadFinishInfoPacket}
 * is received from the server to let us know that the file is **actually** done on the server.
 *
 * Never call this function directly. This is the job of the queue.
 */
async function upload(handle: UploadAbsoluteFileHandle) {
    // If we are not presently connected to anything, this will
    // halt execution of the function until we are.
    const com = await getOrCreateCommunicator();
    const name = attemptRepairFolderOrFileName(handle.file.name);
    if (!patterns.fileName.test(name)) {
        await Dialogs.alert({ body: `Invalid file name: ${handle.file.name}\nAttempted fix: ${name}\nThis did not work either. Sorry!` });
        checkInQueueAndStart();
        return;
    }
    const reply = await com.sendPacketAndReply_new(
        new UploadRequestPacket({ name, path: handle.path, is_public: true, size: handle.file.size }),
        UploadResponsePacket
    );
    if (!reply.packet) {
        logError("Error on sending a upload request: " + reply.error);
        checkInQueueAndStart();
        return;
    }
    const { accepted, upload_address, chunk_size, rejection_reason, rename_target, upload_id } = reply.packet.getData();
    if (!accepted) {
        await Dialogs.alert({ body: `File ${name} at ${handle.path} was not accepted due to: ${rejection_reason ?? "unknown"}` });
        checkInQueueAndStart();
        return;
    }

    const uploadAddress = upload_address as string;

    if (rename_target) {
        // TODO: notify user when the file name was changed!
        //       is already adjusted for display down below
    }

    const abortController = new AbortController();
    const { signal } = abortController;

    const read = streamFromFile(handle.file, chunk_size, abortController);
    const cc = Math.ceil(handle.file.size / chunk_size);

    const au: ActiveUpload = {
        id: upload_id as UUID,
        target_address: uploadAddress,
        chunks: cc,
        processed_chunks: ref(0),
        processed_bytes: ref(0),
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
    const speedIntervalSeconds = Constants.speedCalculationIntervalMs / 1000;
    const interval = setInterval(() => {
        if (signal.aborted) {
            clearInterval(interval);
            return;
        }
        const delta = au.processed_bytes.value - lastProgress;
        lastProgress = au.processed_bytes.value;
        // We cannot just use 1 second as the divider, that is
        // dependent on how often this interval is fired.
        au.speed.value = delta / speedIntervalSeconds;
    }, Constants.speedCalculationIntervalMs);

    if (cc <= 0) {
        throw new Error("Chunk count is " + cc);
    }

    // This config only includes constants that don't change between chunks.
    // Chunk-dependent things get passed as individual parameters.
    const cfg: PrepareChunkConfig = { read, handle: au, signal };

    const concurrency = createChunkConcurrency(cc);
    let latestChunkIndex = -1;
    // Sadly, this wrapper also has to exist due to the concurrency needs.
    async function wrapper(chunkIndex: number): Promise<void> {
        if (latestChunkIndex !== chunkIndex - 1) throw new Error(`Previous latest index was ${latestChunkIndex}, now would be ${chunkIndex}`);
        latestChunkIndex = chunkIndex;
        concurrency.increment();

        const { promise: sentPromise, resolve: sentResolve } = createResolveFunction<boolean>();
        const resultPromise = prepareAndRetryChunk(cfg, chunkIndex, sentResolve);

        sentPromise.then(() => {
            if (!concurrency.canStartNext()) return;
            // This does not use "chunkIndex + 1" due to the fact that this might be chunk 1
            // here, but chunk 2 is already finished and has started chunk 3 by now. Then, we'd
            // want this to start chunk 4.
            wrapper(latestChunkIndex + 1);
        });

        const result = await resultPromise;
        result.success ? concurrency.markDone() : concurrency.markFail(result.sendAbortPacket);
        concurrency.decrement();
    }

    wrapper(0);
    const result = await concurrency.done;

    clearInterval(interval);
    if (!result.success && result.sendAbortPacket) {
        const com = await getOrCreateCommunicator();
        void com.sendPacket(new UploadAbortRequestPacket({ upload_id }));
    }
}

type PrepareChunkConfig = { handle: ActiveUpload; read: () => Promise<StreamFromFileReturn>; signal: AbortSignal };
async function prepareAndRetryChunk(cfg: PrepareChunkConfig, chunkIndex: number, sentResolve: ResolveFunction<boolean>): Promise<SendChunkStatus> {
    const { handle, read, signal } = cfg;
    // We can only load this buffer once as it comes out of a stream
    // we cannot reverse. If the upload has failed, we have to retry
    // the upload itself, but never the stream reading.
    const buffer = await read();

    // This is before the buffer.done if clause because when the upload is
    // aborted, the stream function returns done = true regardless of
    // the actual state.
    if (signal.aborted) {
        logWarn("Aborted upload", handle);
        // If the server informed us of the abort, we need not ask for one from it.
        return { success: false, sendAbortPacket: signal.reason !== SERVER_INITIATED_ABORT };
    }
    if (buffer.done) {
        // If this happend, shit has hit the fan.
        throw new Error(`Stream reported done despite chunks still remaining: ${handle.id} | Chunk: ${chunkIndex}`);
    }

    const sendChunkCfg = {
        uploadId: handle.id,
        targetAddress: handle.target_address,
        chunkIndex,
        dataBuffer: buffer.value,
        progressRef: handle.processed_bytes
    };

    let attempt = 0;
    // If we once already sent this chunk, we won't trigger the concurrency.
    let flag_hasFinishedSent = false;
    while (attempt < Constants.maxRetriesForChunkUpload) {
        if (signal.aborted) {
            logWarn("Aborted upload", handle);
            return { success: false, sendAbortPacket: signal.reason !== SERVER_INITIATED_ABORT };
        }

        const { sent: promise_sent, response: promise_response } = sendChunk(sendChunkCfg, signal);

        const status_sent = await promise_sent;
        // Only if the sending succeeded, we need bother to wait for the response promise.
        block_success: if (status_sent) {
            if (!flag_hasFinishedSent) {
                flag_hasFinishedSent = true;
                sentResolve(true);
            }
            const status_response = await promise_response;
            if (!status_response) break block_success;
            return { success: true };
        }

        logWarn(`(Attempt ${attempt + 1}/${Constants.maxRetriesForChunkUpload}) Failed to upload chunk ${chunkIndex} for upload`, handle);

        attempt++;
        continue;
    }

    logError("Failed to upload the file after too many failed attempts to upload the chunk");
    // To continue with the next file instead of waiting for the service
    // to terminate us, we request an abort here.
    return { success: false, sendAbortPacket: true };
}

/**
 * Handles concurrency for uploading multiple chunks for one file at a time
 * instead of waiting until one chunk has received a response to start the
 * next one. This is intended to speed up the uploading of large files.´
 *
 * It is vital that a new chunk may only be started once we fully transferred
 * the buffer to the service. If we would just send multiple chunks at once,
 * they'd all run with slower speeds, in effect making that useless. Building
 * a system like here though only uses the bandwith more effectively by not
 * waiting for the upload service to encrypt and to send to Discord.
 *
 * The count is limited to {@link Constants.maxConcurrentChunks}.
 */
function createChunkConcurrency(chunkCount: number) {
    let activeCount = 0;
    let doneCount = 0;
    // Because of the way this is built, some other wrapper might call
    // one of these functions after thw whole upload has failed.
    let isLocked = false;
    // Resolves upon all chunks being done or one having failed.
    const { promise, resolve } = createResolveFunction<SendChunkStatus>();
    function increment() {
        if (activeCount === Constants.maxConcurrentChunks) throw new RangeError("Cannot increment concurrent chunks above defined max");
        activeCount++;
    }
    function decrement() {
        if (activeCount === 0) throw new RangeError("Cannot decrement concurrent chunks below 0");
        activeCount--;
    }
    /**
     * Called whenever a chunk has been successfully finished.
     * When all chunks are marked as such, the function will
     * resolve the promise of the wrapper.
     */
    function markDone() {
        if (doneCount === chunkCount) throw new RangeError("Cannot increment the done count above the chunk count");
        doneCount++;
        if (doneCount === chunkCount) resolve({ success: true });
    }
    /**
     * Called when the upload of the chunk has failed for good.
     * When called, the entire file upload will fail.
     */
    function markFail(sendAbortPacket: boolean) {
        isLocked = true;
        resolve({ success: false, sendAbortPacket });
    }
    /**
     * Checks whether the max concurrent amount allows a new chunk to start and
     * that there are still any chunks left to actually start.
     */
    function canStartNext(): boolean {
        if (isLocked) return false;
        return activeCount < Constants.maxConcurrentChunks && activeCount + doneCount < chunkCount;
    }
    return { increment, decrement, canStartNext, markDone, markFail, done: promise };
}

function handleUploadFinish(packet: UploadFinishInfoPacket) {
    const { success, upload_id, reason } = packet.getData();
    const handle = activeUploads.get(upload_id as UUID);
    if (!handle) {
        logWarn("Received finish packet for unknown upload:", upload_id);
        return;
    }
    // If we manually aborted the upload, then the signal is already toggled.
    // But even then, the server sends us the upload finish packet.
    if (!success && handle.abort_controller && !handle.abort_controller?.signal.aborted) {
        handle.abort_controller.abort(SERVER_INITIATED_ABORT);
    }
    if (!success) {
        logError(`Upload failed due to ${reason ?? "unknown"}`);
        console.error(`${handle.path} | ${handle.name}`);
    }
    // We rely entirely on this function to check when an upload is "done".
    // If we were to go by the metric that all chunks have been sent, the
    // data might not yet be stored in the DB and a new upload start request
    // would be rejected by the server.
    activeUploads.delete(upload_id as UUID);
    releaseServicesIfDone();
    checkInQueueAndStart();
}

interface SendConfig {
    uploadId: UUID;
    targetAddress: string;
    chunkIndex: number;
    dataBuffer: Uint8Array<ArrayBuffer>;
    progressRef: Ref<number>;
}
function sendChunk(cfg: SendConfig, signal?: AbortSignal) {
    const sentPromise = createResolveFunction<boolean>();
    const responsePromise = createResolveFunction<boolean>();

    (async () => {
        const form = new FormData();
        form.append("id", cfg.uploadId);
        form.append("chunk", cfg.chunkIndex.toString());
        form.append("file", new Blob([cfg.dataBuffer]));

        const timestamp = performance.now();

        const xhr = new XMLHttpRequest();
        xhr.open("POST", cfg.targetAddress);
        let loaded_lastValue = 0;
        xhr.upload.addEventListener("progress", ({ loaded, lengthComputable, total }) => {
            if (!lengthComputable) {
                logWarn(`Cannot access tranferred byte count for chunk ${cfg.chunkIndex} of "${cfg.uploadId}" - concurrency won't work`);
                return;
            }
            const deltaBytes = loaded - loaded_lastValue;
            loaded_lastValue = loaded;
            cfg.progressRef.value += deltaBytes;

            // This may trigger multiple times but as we are dealing with a promise
            // which may only be resolved once, we need not worry.
            if (loaded >= total) {
                sentPromise.resolve(true);
                const timestampEnd = performance.now();
                logDebug(
                    `Transferred chunk ${cfg.chunkIndex} (${formatByteString(cfg.dataBuffer.length)}) of "${cfg.uploadId}" in ${timestampEnd - timestamp}ms`
                );
            }
        });

        xhr.onload = () => {
            const hasSucceeded = xhr.status === 200;
            resolve(hasSucceeded);
        };

        function xhrAbort() {
            xhr.abort();
        }

        function resolve(flag: boolean) {
            // Even though sendPromise might already be resolved, there would
            // be no pain in just resolving it again - that just does nothing.
            sentPromise.resolve(flag);
            responsePromise.resolve(flag);
            signal?.removeEventListener("abort", xhrAbort);
        }
        const resolveWithFalse = () => resolve(false);
        xhr.onerror = resolveWithFalse;
        xhr.onabort = resolveWithFalse;

        signal?.addEventListener("abort", xhrAbort);

        xhr.send(form);
    })();

    return { sent: sentPromise.promise, response: responsePromise.promise };
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
