import express, { type Request, type Response } from "express";
import multer from "multer";
import { clearUploadState, getUploadState, isBusy, type UploadData } from "./state.ts";
import { patterns } from "../common/patterns.ts";
import { Socket } from "./Socket.ts";
import { sendWebhookMessage } from "./discord.ts";
import { formatJSON } from "../common/useless.ts";
import { UploadFinishPacket } from "../common/packet/u2s/UploadFinishPacket.ts";
import { fileTypeFromBuffer } from "file-type";
import { createHashFromBinaryLike, encryptBuffer } from "../common/crypto.ts";
import { lengthenTimeout, resetRequestTimeout, startRequestTimeout } from "./timeout.ts";
import { getEnvironmentVariables, validateEnviromentVariables } from "../common/environment.ts";
validateEnviromentVariables("common", "upload-service");

const app = express();
const upload = multer();

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
    if (!patterns.integer.test(chunk) || isNaN(chunkId) || chunkId < 0 || chunkId >= data.chunks.length) {
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
    if (bufferSize !== data.chunks[chunkId]) {
        respondWithError(res, "Chunk size is invalid");
        return null;
    }

    return { file, chunkId };
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
        return respondWithError(res, "Failed to upload chunk to Discord - please try again", 500);
    }

    console.info("[Upload] Finished chunk", chunkId);

    data.processing.delete(chunkId);
    data.completed_chunks.set(chunkId, result);

    // This is called every time, even if not yet done,
    // to renew the possible timeout looming
    finishUploadIfDone(data);
    respondWithError(res, null, 200);
}

app.listen(getEnvironmentVariables("upload-service").PORT, () => console.log("Upload service is listening"));

function finishUploadIfDone(data: UploadData) {
    if (data.completed_chunks.size !== data.chunks.length) {
        lengthenTimeout();
        return;
    }

    void socket.sendPacket(
        new UploadFinishPacket({
            success: true,
            messages: Array.from(data.completed_chunks.values()),
            is_encrypted: data.should_encrypt,
            hash: combineHashes(data),
            type: data.type,
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
            reason
        })
    );
    console.info("[Upload] Failed!", reason);
    clearUploadState();
    // In such a case, the timeout has not been reached,
    // so an error should not be dispatched.
    resetRequestTimeout(false);
}

export async function startWatchingTimeout(chunks: number[]) {
    const result = await startRequestTimeout(chunks.length);
    // If this is false, the timeout was never reached, but the request has been finished correctly
    if (!result) {
        return;
    }
    cancelUpload("Timeout exceeded");
}
