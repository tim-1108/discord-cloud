import type { Request, Response } from "express";
import { generateErrorResponse, generateResponse, getRequestQuery } from "../utils/http.js";
import { patterns } from "../../common/patterns.js";
import { parseSignedFileDownload } from "../database/public.js";
import { Database } from "../database/index.js";

export default async function handleRequest(req: Request, res: Response): Promise<void> {
    const query = getRequestQuery(req);
    if (!query) {
        return void generateErrorResponse(res, 400, "Bad request query");
    }
    const encryptedMetadata = query.get("q");
    if (!encryptedMetadata || !patterns.base64Url.test(encryptedMetadata)) {
        return void generateErrorResponse(res, 400, "Missing or bad download metadata");
    }

    const fileData = parseSignedFileDownload(encryptedMetadata);

    if (!fileData) {
        return void generateErrorResponse(res, 400, "Failed to parse encrypted metadata");
    }

    const { name, path, hash } = fileData;
    const handle = await Database.file.getWithPath(name, path);
    if (!handle) {
        return void generateErrorResponse(res, 404, "Not Found");
    }

    if (handle.hash !== hash) {
        return void generateErrorResponse(res, 403, "The data of this file has changed. Please obtain a new signed download.");
    }

    generateResponse(res, 200, { name, path, size: handle.size });
}
