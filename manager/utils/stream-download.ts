import { decryptBuffer } from "../../common/crypto.js";
import { downloadBinaryData, getBulkMessageAttachments } from "../../common/discord.js";
import { logDebug, logError } from "../../common/logging.js";
import { sortMapValuesAsArrayByKeyArray } from "../../common/useless.js";
import { enqueue, shiftQueue } from "../../common/processing-queue.js";
import type { Writable } from "node:stream";
import type { FileHandle } from "../../common/supabase.js";

export async function streamFileContents(target: Writable, file: FileHandle): Promise<string | null> {
    await enqueue();

    const links = await getBulkMessageAttachments(file.messages, file.channel);
    if (!links || links.values().some((value) => value === null)) {
        shiftQueue();
        return "Failed to load all message links, please try again";
    }

    // If these wouldn't be sorted, they'd come in as they were uploaded to Discord
    // This might be in some random order. They have to be sorted by their ordering in the DB
    // and cannot be just sorted via Discord message id.
    const sortedLinks = sortMapValuesAsArrayByKeyArray(links, file.messages);
    if (!sortedLinks) {
        shiftQueue();
        return "If you see this error, The Impossible has arrived";
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
            target.end();
            // Sadly, this is a silent fail.
            // It appears we cannot tell the client that this failed
            // - Status codes and headers might have already been sent
            // - If we were to send an error message, it might just append it to the download
            // - If the Content-Length should then something else than the header, it might fail client-side (CHECK THIS)
            logError("Failed to download chunk", link, "for file", file);
            return "Failed to download a chunk";
        }
        const decryptedBuffer = file.is_encrypted ? decryptBuffer(Buffer.from(arrayBuffer)) : Buffer.from(arrayBuffer);
        target.write(decryptedBuffer);
    }
    target.end();
    shiftQueue();
    return null;
}
