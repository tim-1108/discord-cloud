import express, { type Request, type Response } from "express";
import multer from "multer";
import type { DataErrorFields } from "../common";
import { patterns } from "../common/patterns.js";
import { Upload, type Data } from "./index.js";
import { getChunkSizeAtIndex } from "./utils.js";
import { logError, logInfo } from "../common/logging.js";
import { getEnvironmentVariables } from "../common/environment.js";

const env = getEnvironmentVariables("upload-service");
const app = express();

export function initNetwork() {
    app.listen(parseInt(env.PORT), () => logInfo(`HTTP open on port ${env.PORT}`));
}

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

app.post("/", multer({ limits: { fileSize: 10 * 1024 * 1024 - 1024 } }).single("file"), event$fileUpload);

app.use((error: unknown, req: Request, res: Response, next: unknown) => {
    res.status(500).json({ error: "Internal Server Error" });
});

function respondWithError(res: Response, error: any, statusCode: number = 400) {
    res.status(statusCode).json({ error }).end();
}

async function event$fileUpload(req: Request, res: Response): Promise<void> {
    const data = Upload.data;
    if (data.value === null) {
        logInfo("Attempted to upload file whilst nothing is registered");
        respondWithError(res, "No upload has been registered with this service");
        return;
    }

    const file = validateAndParseRequest(req, data.value);
    if (!file.data) {
        logError("Request invalid:", file.error);
        respondWithError(res, file.error);
        return;
    }

    const status = await Upload.event.submitFile(file.data.buffer, file.data.chunk_id);
    if (!status.success) {
        respondWithError(res, status.error || "An unspecified error whilst processing chunk", 500);
        return;
    }
    res.status(200).send(file.data.chunk_id);
}

function validateAndParseRequest(req: Request, data: Data): DataErrorFields<{ buffer: Buffer; chunk_id: number }, string> {
    const type = req.headers["content-type"];
    if (!type || !patterns.multipart.test(type)) {
        return { data: null, error: "Invalid Content Type" };
    }
    const { id, chunk } = req.body;
    if (id !== data.metadata.upload_id) {
        return { data: null, error: "The supplied upload id does not match the required id" };
    }

    const chunkId = parseInt(chunk, 10);
    if (!patterns.integer.test(chunk) || isNaN(chunkId) || chunkId < 0 || chunkId >= data.chunk_count) {
        return { data: null, error: "The supplied chunk id is invalid or too high" };
    }

    if (data.completed_chunks.has(chunkId) || data.processing_chunks.has(chunkId)) {
        return { data: null, error: "This chunk either has already been sent or is currently still processing" };
    }

    const file = req.file;
    if (!file || !(file.buffer instanceof Buffer)) {
        return { data: null, error: "No file parameter provided or has not been parsed as a buffer" };
    }

    const suppliedSize = file.buffer.length;
    const desiredSize = getChunkSizeAtIndex(chunkId, data.metadata.size, data.metadata.chunk_size, data.chunk_count);
    if (suppliedSize !== desiredSize) {
        return { data: null, error: "The supplied buffer size does not match the desired size for this chunk" };
    }

    return { data: { buffer: file.buffer, chunk_id: chunkId }, error: null };
}
