import express, { type Request, type Response } from "express";
import multer from "multer";
import { clearUploadState, getUploadState, isBusy, type UploadData } from "./state.js";
import { patterns } from "../common/patterns.js";
import { Socket } from "./Socket.js";
import { sendWebhookMessage } from "./discord.js";
import { formatJSON } from "../common/useless.js";
import { UploadFinishPacket } from "../common/packet/u2s/UploadFinishPacket.js";
import { fileTypeFromBuffer } from "file-type";
import { createHashFromBinaryLike, encryptBuffer } from "../common/crypto.js";
import { lengthenTimeout, resetRequestTimeout, startRequestTimeout } from "./timeout.js";
import { getEnvironmentVariables, validateEnvironmentVariables } from "../common/environment.js";
validateEnvironmentVariables("common", "upload-service");

const app = express();
const upload = multer();

app.use(async (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    if (req.method === "OPTIONS") {
        res.end();
        return;
    }
    next();
});

app.post("/", upload.single("file"), onFileUpload);

app.use((error: unknown, req: Request, res: Response, next: unknown) => {
    res.status(500).json({ error: "Internal Server Error" });
});

function respondWithError(res: Response, error: any, statusCode: number = 400) {
    res.status(statusCode).json({ error }).end();
}

const socket = new Socket();

function validateRequest(req: Request, res: Response, data: UploadData) {
    const type = req.headers["content-type"];
    if (!type || !patterns.multipart.test(type)) {
        respondWithError(res, "Invalid content type");
        return null;
    }
    const { id, chunk } = req.body;
    if (id !== data.metadata.upload_id) {
        respondWithError(res, "Invalid upload id", 403);
        return null;
    }

    const chunkId = parseInt(chunk, 10);
    if (!patterns.integer.test(chunk) || isNaN(chunkId) || chunkId < 0 || chunkId >= data.chunk_count) {
        respondWithError(res, "Invalid chunk");
        return null;
    }

    if (data.completed_chunks.has(chunkId) || data.processing.has(chunkId)) {
        respondWithError(res, "This chunk has already been sent");
        return null;
    }

    const file = req.file;
    if (!file || !(file.buffer instanceof Buffer)) {
        respondWithError(res, "No file provided");
        return null;
    }

    const bufferSize = file.buffer.length;
    const desired = getChunkSizeAtIndex(chunkId, data.metadata.size, data.metadata.chunk_size, data.chunk_count);
    if (bufferSize !== desired) {
        respondWithError(res, "Chunk size is invalid");
        return null;
    }

    return { file, chunkId };
}

function getChunkSizeAtIndex(i: number, s: number, cs: number, cc: number) {
    if (cc === 1) {
        return s;
    }

    if (i < cc - 1) {
        return cs;
    }
    // The last chunk is just the remainder
    return s % cs;
}

async function onFileUpload(req: Request, res: Response): Promise<void> {
    const data = getUploadState();
    if (!data) {
        respondWithError(res, "No file is uploading");
        return;
    }
    const requestData = validateRequest(req, res, data);
    if (!requestData) return;

    const { chunkId, file } = requestData;

    if (chunkId === 0) {
        const type = await fileTypeFromBuffer(file.buffer);
        if (type) data.type = type.mime;
    }

    // Creates the hash of only this buffer to later combine all of them!
    data.hashes[chunkId] = createHashFromBinaryLike(file.buffer);

    data.processing.add(chunkId);
    const mayBeEncrypted = data.should_encrypt ? encryptBuffer(file.buffer) : file.buffer;
    const result = await sendWebhookMessage(mayBeEncrypted, chunkId, "```json\n" + formatJSON(data.metadata) + "\n```");

    // If this single upload failed, the user may feel free to try again.
    // However, the call to the Discord api may be in a timeout, so this may take some time
    if (!result) {
        data.processing.delete(chunkId);
        return respondWithError(res, "Failed to upload chunk to Discord", 500);
    }

    console.info("[Upload] Finished chunk", chunkId);

    data.processing.delete(chunkId);
    data.completed_chunks.set(chunkId, result.id);
    data.channel_id = result.channel_id;

    // This is called every time, even if not yet done,
    // to renew the possible timeout looming
    finishUploadIfDone(data);
    respondWithError(res, null, 200);
}

app.listen(getEnvironmentVariables("upload-service").PORT, () => console.log("Upload service is listening"));

function finishUploadIfDone(data: UploadData) {
    if (data.completed_chunks.size !== data.chunk_count) {
        lengthenTimeout();
        return;
    }

    if (!data.channel_id) {
        cancelUpload("Channel id not set properly");
        return;
    }

    void socket.sendPacket(
        new UploadFinishPacket({
            success: true,
            messages: Array.from(data.completed_chunks.values()),
            is_encrypted: data.should_encrypt,
            hash: combineHashes(data),
            type: data.type,
            channel: data.channel_id,
            reason: undefined
        })
    );
    console.info("[Upload] Finished!", data);
    clearUploadState();
    resetRequestTimeout(false);
}

function combineHashes(data: UploadData) {
    const concatenated = data.hashes.join("");
    return createHashFromBinaryLike(concatenated);
}

export function cancelUpload(reason?: string) {
    if (!isBusy()) return;
    void socket.sendPacket(
        new UploadFinishPacket({
            success: false,
            messages: undefined,
            is_encrypted: undefined,
            hash: undefined,
            type: undefined,
            channel: undefined,
            reason
        })
    );
    console.info("[Upload] Failed!", reason);
    clearUploadState();
    // In such a case, the timeout has not been reached,
    // so an error should not be dispatched.
    resetRequestTimeout(false);
}

export async function startWatchingTimeout(chunks: number) {
    const result = await startRequestTimeout(chunks);
    // If this is false, the timeout was never reached, but the request has been finished correctly
    if (!result) {
        return;
    }
    cancelUpload("Timeout exceeded");
}
