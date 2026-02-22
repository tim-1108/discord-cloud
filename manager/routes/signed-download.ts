import type { Request, Response } from "express";
import { generateErrorResponse, getRequestQuery, getRequestUrl, isCrawlerRequest } from "../utils/http.js";
import { patterns } from "../../common/patterns.js";
import { escapeQuotes, formatByteString } from "../../common/useless.js";
import { logDebug } from "../../common/logging.js";
import { streamFileToResponse_wrapper } from "../utils/stream-download.js";
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

    logDebug("Requested signed file download with", fileData);

    const { name, folderId, hash } = fileData;
    const handle = await Database.file.get(folderId ?? "root", name);
    if (!handle) {
        return void generateErrorResponse(res, 404, "Not Found");
    }

    if (handle.hash !== hash) {
        return void generateErrorResponse(res, 403, "The data of this file has changed. Please obtain a new signed download.");
    }

    if (isCrawlerRequest(req)) {
        const route = Database.folder.resolveRouteById(handle.folder ?? "root");
        const path = route ? routeToPath(route) : "unknown";
        res.setHeader("Content-Type", "text/html");
        res.send(`
        <html>
            <head>
                <meta property="og:title" content="${escapeQuotes(fileData.name)}" />
                <meta property="og:type" content="website" />
                <meta property="og:url" content="${getRequestUrl(req)?.toString()}" />
                <meta property="og:description" content="File &quot;${escapeQuotes(fileData.name)}&quot; at ${escapeQuotes(path)} (${formatByteString(handle.size)})"
            </head>
            <body></body>
        </html>
    `);
        return;
    }

    void streamFileToResponse_wrapper(req, res, handle);
}
