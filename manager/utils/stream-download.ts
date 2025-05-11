import type { Request, Response } from "express";
import { decryptBuffer } from "../../common/crypto.js";
import { downloadBinaryData, getBulkMessageAttachments } from "../../common/discord.js";
import { logDebug } from "../../common/logging.js";
import { sortMapValuesAsArrayByKeyArray } from "../../common/useless.js";
import type { DatabaseFileRow } from "../database/core.js";
import { enqueue, shiftQueue } from "../../common/processing-queue.js";
import { generateErrorResponse } from "./http.js";

export async function streamDownloadToResponse(req: Request, res: Response, file: DatabaseFileRow) {
    if (!file.channel) {
        // TODO: migrate all files to have a channel field set at all times!
        return void generateErrorResponse(res, 503, "Sorry, this is a legacy file that cannot be downloaded this way");
    }
    await enqueue();

    res.setHeader("Content-Disposition", `attachment; filename="${file.name}"`);
    res.setHeader("Content-Length", file.size);
    res.write("");

    const links = await getBulkMessageAttachments(file.messages, file.channel);
    if (!links || links.values().some((value) => value === null)) {
        shiftQueue();
        return void generateErrorResponse(res, 500, "Failed to load all message links, please try again");
    }

    // If these wouldn't be sorted, they'd come in as they were uploaded to Discord
    // This might be in some random order. They have to be sorted by their ordering in the DB
    // and cannot be just sorted via Discord message id.
    const sortedLinks = sortMapValuesAsArrayByKeyArray(links, file.messages);
    if (!sortedLinks) {
        shiftQueue();
        return void generateErrorResponse(res, 500, "If you see this error, The Impossible has arrived");
    }

    logDebug("File with name", file.name, "has attachments", sortedLinks);

    // This incremental download of chunks (24mb each at most) should prevent
    // any memory overruns. If we'd have to download all chunks and patch them together,
    // this might create big big problems (especially decrypting them all as one)
    for (const link of sortedLinks) {
        const arrayBuffer = await downloadBinaryData(
            link as string /* we can be sure this is a string, due to links.values().some() check - maybe clear this up */
        );
        if (!arrayBuffer) {
            shiftQueue();
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
    shiftQueue();
}
