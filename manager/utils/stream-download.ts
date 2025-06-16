import { decryptBuffer } from "../../common/crypto.js";
import { logDebug, logError } from "../../common/logging.js";
import { createResolveFunction, sortMapValuesAsArrayByKeyArray } from "../../common/useless.js";
import { enqueue, shiftQueue } from "../../common/processing-queue.js";
import type { Writable } from "node:stream";
import type { FileHandle } from "../../common/supabase.js";
import { Discord } from "../../common/discord_new.js";
import type { Socket } from "node:net";

/**
 * If the stream is not drained within this millisecond amount,
 * the target is closed. This means, for instance, if an HTTP
 * target cannot download a chunk (10MB) within this timeframe,
 * the TCP connection is terminated.
 * (Within 100 seconds, this equates to a speed of 100kbytes/s)
 * This might seem strict, but we have only a certain amount
 * of processing power and RAM we need to use wisely.
 */
const DRAIN_TIMEOUT = 100_000 as const;
/**
 * Streams the content of the requested file to the supplied
 * writable stream. For instance, this allowes streaming a file
 * to an HTTP response.
 *
 * To handle a closure of the TCP socket of the HTTP connection, supply
 * the `socket` param. This will detect closing and will cancel any downloads.
 */
export async function streamFileContents(target: Writable, file: FileHandle, socket?: Socket | null): Promise<string | null> {
    await enqueue();

    const links = await Discord.bot.getMessages(file.messages, file.channel);
    if (!links.data) {
        // The target stream is not closed here as we might want
        // to allow the caller of this function to write something
        // in there if this failed at this stage.
        shiftQueue();
        return links.error;
    }

    // TODO: Implement the Range header

    // If this function has been accidentially called again after the socket
    // had already been closed, we should never write to the stream.
    // NOTE: This might be actually impossible as the socket is disconnected
    //       (?) from the HTTP response object when it is closed.
    //       So basically, do not call this function when you are done...
    let _closed = socket && socket.closed ? true : false;
    const closeFn = () => (_closed = true);
    if (socket) {
        socket.on("close", closeFn);
        socket.on("error", closeFn);
        // This means an actual FIN packet has been sent by the client
        socket.on("end", closeFn);
    }

    function end() {
        shiftQueue();
        target.end();
        if (socket) {
            // cleanup to not exceed the listener limit
            socket.removeListener("close", closeFn);
            socket.removeListener("error", closeFn);
            socket.removeListener("end", closeFn);
        }
    }

    // If these wouldn't be sorted, they'd come in as they were uploaded to Discord
    // This might be in some random order. They have to be sorted by their ordering in the DB
    // and cannot be just sorted via Discord message id.
    const sortedLinks = sortMapValuesAsArrayByKeyArray(links.data, file.messages);
    if (!sortedLinks) {
        shiftQueue();
        return "If you see this error, The Impossible has arrived";
    }

    for (const link of sortedLinks) {
        if (_closed || !target.writable) {
            end();
            return "Socket has been prematurely closed";
        }
        const response = await Discord.cdn.fetch(link);
        if (!response.buffer) {
            end();
            // Sadly, this is a silent fail (on downloads).
            // It appears we cannot tell the client that this failed
            // - Status codes and headers might have already been sent
            // - If we were to send an error message, it might just append it to the download
            // - If the Content-Length should then something else than the header, it might fail client-side (CHECK THIS)
            logError("Failed to download chunk", link, "for file", file);
            return "Failed to download a chunk";
        }
        const buf = file.is_encrypted ? decryptBuffer(Buffer.from(response.buffer)) : Buffer.from(response.buffer);
        // If this return value is false, we should wait until the target stream
        // is free to take in data once again.
        const result = target.write(buf);
        if (result) {
            continue;
        }

        const { promise, resolve } = createResolveFunction<boolean>();
        setTimeout(() => resolve(false), DRAIN_TIMEOUT);
        target.once("drain", () => resolve(true));
        const r = await promise;
        if (!r) {
            end();
            return "Target did not drain in time";
        }
        continue; /* explicit, although useless */
    }
    end();
    return null;
}
