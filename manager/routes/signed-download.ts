import type { Request, Response } from "express";
import { generateErrorResponse, getRequestQuery, getRequestUrl, isCrawlerRequest } from "../utils/http.js";
import { patterns } from "../../common/patterns.js";
import { parseSignedFileDownload } from "../database/public.js";
import { escapeQuotes, parseFileSize } from "../../common/useless.js";
import { getFileFromDatabase } from "../database/finding.js";
import { logDebug } from "../../common/logging.js";
import { streamDownloadToResponse } from "../utils/stream-download.js";

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

    logDebug("Requested signed file download with", fileData);

    const { name, path, hash } = fileData;
    const file = await getFileFromDatabase(name, path);
    if (!file) {
        return void generateErrorResponse(res, 404, "Not Found");
    }

    if (file.hash !== hash) {
        return void generateErrorResponse(res, 403, "The data of this file has changed. Please obtain a new signed download.");
    }

    if (isCrawlerRequest(req)) {
        res.setHeader("Content-Type", "text/html");
        res.send(`
        <html>
            <head>
                <meta property="og:title" content="${escapeQuotes(fileData.name)}" />
                <meta property="og:type" content="website" />
                <meta property="og:url" content="${getRequestUrl(req)?.toString()}" />
                <meta property="og:description" content="File &quot;${escapeQuotes(fileData.name)}&quot; at ${escapeQuotes(fileData.path)} (${parseFileSize(file.size)})"
            </head>
            <body></body>
        </html>
    `);
        return;
    }

    return streamDownloadToResponse(req, res, file);
}
