import type { Request, Response } from "express";
import { generateErrorResponse, getRequestQuery, getRequestUrl, isCrawlerRequest } from "../utils/http.js";
import { patterns } from "../../common/patterns.js";
import { parseSignedFileDownload } from "../database/public.js";
import { escapeQuotes, parseFileSize, sortMapValuesAsArrayByKeyArray } from "../../common/useless.js";
import { getFileFromDatabase } from "../database/finding.js";
import { nextRequest, queueRequest } from "../http-queue.js";
import { getBulkMessageAttachments } from "../../common/discord.js";
import { decryptBuffer } from "../../common/crypto.js";
import { logDebug, logInfo } from "../../common/logging.js";

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

    if (!file.channel) {
        // TODO: migrate all files to have a channel field set at all times!
        return void generateErrorResponse(res, 503, "Sorry, this is a legacy file that cannot be downloaded this way");
    }

    await queueRequest(req);

    res.setHeader("Content-Disposition", `attachment; filename="${file.name}"`);
    res.setHeader("Content-Length", file.size);
    res.write("");

    const links = await getBulkMessageAttachments(file.messages, file.channel);
    if (!links || links.values().some((value) => value === null)) {
        nextRequest();
        return void generateErrorResponse(res, 500, "Failed to load all message links, please try again");
    }

    // If these wouldn't be sorted, they'd come in as they were uploaded to Discord
    // This might be in some random order. They have to be sorted by their ordering in the DB
    // and cannot be just sorted via Discord message id.
    const sortedLinks = sortMapValuesAsArrayByKeyArray(links, file.messages);
    if (!sortedLinks) {
        nextRequest();
        return void generateErrorResponse(res, 500, "If you see this error, The Impossible has arrived");
    }

    logDebug("File with name", name, "has attachments", sortedLinks);

    // This incremental download of chunks (24mb each at most) should prevent
    // any memory overruns. If we'd have to download all chunks and patch them together,
    // this might create big big problems (especially decrypting them all as one)
    for (const link of sortedLinks) {
        const arrayBuffer = await downloadBinaryData(
            link as string /* we can be sure this is a string, due to links.values().some() check - maybe clear this up */
        );
        if (!arrayBuffer) {
            nextRequest();
            res.end();
            // Sadly, this is a silent fail.
            // It appears we cannot tell the client that this failed
            // - Status codes and headers might have already been sent
            // - If we were to send an error message, it might just append it to the download
            // - If the Content-Length should then something else than the header, it might fail client-side (CHECK THIS)
            console.error("[SignedDownload] Failed to download chunk", link, "for file", file);
            return;
        }
        const decryptedBuffer = file.is_encrypted ? decryptBuffer(Buffer.from(arrayBuffer)) : Buffer.from(arrayBuffer);
        res.write(decryptedBuffer);
    }
    res.end();
    nextRequest();
}

async function downloadBinaryData(link: string) {
    try {
        const response = await fetch(link);
        if (!response.ok) return null;
        return await response.arrayBuffer();
    } catch {
        return null;
    }
}
