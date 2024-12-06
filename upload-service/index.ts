import express, { type Request, type Response } from "express";
import multer from "multer";
import { endCurrentUpload, getCurrentUpload } from "./state.ts";
import { patterns } from "../common/patterns.ts";
import { Socket } from "./Socket.ts";
import dotenv from "dotenv";
import { sendWebhookMessage } from "./discord.ts";
import { formatJSON } from "../common/useless.ts";
import { UploadFinishPacket } from "../common/packet/u2s/UploadFinishPacket.ts";
dotenv.config({ path: `${__dirname}/.env` });

export function getEnviromentVariables() {
    const { PASSWORD, SOCKET_ADDRESS, ADDRESS } = process.env;
    if (!PASSWORD || !SOCKET_ADDRESS || !ADDRESS) throw new ReferenceError("Missing environment variables");
    return { password: PASSWORD, socketAddress: SOCKET_ADDRESS, address: ADDRESS };
}

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

async function onFileUpload(req: Request, res: Response): Promise<void> {
    const data = getCurrentUpload();
    if (!data) {
        return respondWithError(res, "No file is uploading");
    }
    const type = req.headers["content-type"];
    if (!type || !patterns.multipart.test(type)) {
        return respondWithError(res, "Invalid content type");
    }
    const { id, chunk } = req.body;
    if (id !== data.metadata.upload_id) {
        return respondWithError(res, "Invalid upload id", 403);
    }

    const chunkId = parseInt(chunk, 10);
    if (!patterns.integer.test(chunk) || isNaN(chunkId) || chunkId < 0 || chunkId >= data.chunks.length) {
        return respondWithError(res, "Invalid chunk");
    }

    if (data.completed_chunks.has(chunkId) || data.processing.has(chunkId)) {
        return respondWithError(res, "This chunk has already been sent");
    }

    const file = req.file;
    if (!(file instanceof File)) {
        return respondWithError(res, "No file is uploading");
    }

    const bufferSize = file.buffer.length;
    if (bufferSize !== data.chunks[chunkId]) {
        return respondWithError(res, "Chunk size is invalid");
    }

    data.processing.add(chunkId);
    const result = await sendWebhookMessage(file.buffer, chunkId, "```json\n" + formatJSON(data.metadata) + "\n```");

    // If this single upload failed, the user may feel free to try again.
    // However, the call to the Discord api may be in a timeout, so this may take some time
    if (!result) {
        data.processing.delete(chunkId);
        return respondWithError(res, "Failed to upload chunk to Discord - please try again", 500);
    }

    data.processing.delete(chunkId);
    data.completed_chunks.set(chunkId, result);

    if (data.completed_chunks.size === data.chunks.length) {
        void socket.sendPacket(new UploadFinishPacket({ success: true, messages: Array.from(data.completed_chunks.values()) }));
        endCurrentUpload();
    }

    respondWithError(res, null, 200);
}

app.listen(process.env.PORT, () => console.log("Upload service is listening"));
