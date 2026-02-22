import type { Request, Response } from "express";
import { generateErrorResponse, generateResponse, getRequestQuery } from "../utils/http.js";
import { patterns } from "../../common/patterns.js";
import { Database } from "../database/index.js";
import { SignedDownload } from "../signed-download.js";
import { routeToPath } from "../database/core.js";

export default async function handleRequest(req: Request, res: Response): Promise<void> {
    const query = getRequestQuery(req);
    if (!query) {
        return void generateErrorResponse(res, 400, "Bad request query");
    }
    const encryptedMetadata = query.get("q");
    if (!encryptedMetadata || !patterns.base64Url.test(encryptedMetadata)) {
        return void generateErrorResponse(res, 400, "Missing or bad download metadata");
    }

    const fileData = SignedDownload.parse(encryptedMetadata);

    if (!fileData) {
        return void generateErrorResponse(res, 400, "Failed to parse metadata");
    }

    const { name, folderId, hash } = fileData;
    const handle = await Database.file.get(folderId ?? "root", name);
    if (!handle) {
        return void generateErrorResponse(res, 404, "Not Found");
    }

    if (handle.hash !== hash) {
        return void generateErrorResponse(res, 403, "The data of this file has changed. Please obtain a new signed download.");
    }

    const route = Database.folder.resolveRouteById(handle.folder ?? "root");
    if (!route) {
        return void generateErrorResponse(res, 500, "Failed to generate route");
    }
    const path = routeToPath(route);

    generateResponse(res, 200, { name, path, size: handle.size });
}
