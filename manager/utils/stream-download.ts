import { decryptBuffer } from "../../common/crypto.js";
import { logError, logInfo } from "../../common/logging.js";
import { createResolveFunction, sortMapValuesAsArrayByKeyArray } from "../../common/useless.js";
import { enqueue, shiftQueue } from "../../common/processing-queue.js";
import { PassThrough, type Writable } from "node:stream";
import type { FileHandle } from "../../common/supabase.js";
import { Discord } from "../../common/discord_new.js";
import type { Socket } from "node:net";
import { getRequestRanges, isHeadRequest, type RequestRange } from "./http.js";
import { Uploads } from "../uploads.js";
import type { Request, Response } from "express";

/**
 * If the stream is not drained within this millisecond amount,
 * the target is closed. This means, for instance, if an HTTP
 * target cannot download a chunk (10MB) within this timeframe,
 * the TCP connection is terminated.
 * (Within 1000 seconds, this equates to a speed of 10kbytes/s)
 * This might seem strict, but we have only a certain amount
 * of processing power and RAM we need to use wisely.
 */
const DRAIN_TIMEOUT = 1_000_000 as const;
/**
 * Streams the content of the requested file to the supplied
 * writable stream. For instance, this allowes streaming a file
 * to an HTTP response.
 *
 * To handle a closure of the TCP socket of the HTTP connection, supply
 * the `socket` param. This will detect closing and will cancel any downloads.
 */
export async function streamFileContents(target: Writable, file: FileHandle, range?: RequestRange, socket?: Socket | null): Promise<string | null> {
    await enqueue();

    logInfo(`Streaming file "${file.name}" in folder ${file.folder} with range ${range ? `${range.from} - ${range.to} bytes` : "full"}`);

    const rangeChunks = range ? getChunkIdsForRange(range) : null;
    // Optimizes message fetching by only fetching those required by the range
    const $msgs = rangeChunks ? file.messages.slice(rangeChunks.from, rangeChunks.to + 1 /* end in .slice is exclusive */) : file.messages;

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

    const links = await Discord.bot.getMessages($msgs, file.channel);
    if (!links.data) {
        end();
        return links.error;
    }

    // If these wouldn't be sorted, they'd come in as they were uploaded to Discord
    // This might be in some random order. They have to be sorted by their ordering in the DB
    // and cannot be just sorted via Discord message id.
    const sortedLinks = sortMapValuesAsArrayByKeyArray(links.data, $msgs);
    if (!sortedLinks) {
        shiftQueue();
        return "If you see this error, The Impossible has arrived";
    }

    let i = 0;
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
            logError(`Failed to download chunk id ${i} with link ${link} for file`, file.id);
            return "Failed to download chunk " + i;
        }
        let buf = file.is_encrypted ? decryptBuffer(Buffer.from(response.buffer)) : Buffer.from(response.buffer);

        // If this is either the start or end chunk, we need
        // to modify the buffer further as we cannot just write
        // the whole thing, only the parts which are needed.
        if (range && rangeChunks) {
            // Both things can be true at the same time.
            // If this is the case, we have to first slice
            // off the end and then the beginning (if we do
            // it with two calls to .subarray like here)
            // Of course, this could also be done in one step.
            // (if we were to have this check to = i & from = i).
            if (rangeChunks.to === i) {
                // + 1 because the end is exclusive.
                buf = buf.subarray(0, range.to - i * Uploads.chunkSize() + 1);
            }
            if (rangeChunks.from === i) {
                buf = buf.subarray(range.from - i * Uploads.chunkSize());
            }
        }
        i++;

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

function getChunkIdsForRange(range: RequestRange) {
    const cs = Uploads.chunkSize();
    const { from: f, to: t } = range;
    const fc = Math.floor(f / cs);
    const tc = Math.floor(t / cs);
    return { from: fc, to: tc };
}

export async function streamFileToResponse_wrapper(req: Request, res: Response, handle: FileHandle) {
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Disposition", `attachment; filename="${handle.name}"`);
    const r = getRequestRanges(req, handle.size);

    if (!r) {
        res.setHeader("Content-Type", handle.type);
        res.setHeader("Content-Length", handle.size);
        if (isHeadRequest(req)) {
            res.end();
            return;
        }
        // I am responsible for causing the headers to be sent to the client before
        // any response body is sent. Without the headers sent, the request might time out.
        res.write("");
        const result = await streamFileContents(res, handle, undefined, res.socket);
        if (result) {
            logError("Failed to stream due to:", result);
        }
        res.end();
        return;
    }

    res.status(206);
    const { ranges, total } = r;
    if (ranges.length === 1) {
        const range = ranges[0];
        const length = range.to - range.from + 1;
        res.setHeader("Content-Type", handle.type);
        res.setHeader("Content-Length", length);
        res.setHeader("Content-Range", `bytes ${range.from}-${range.to}/${length}`);

        if (isHeadRequest(req)) {
            res.end();
            return;
        }

        res.write("");
        const result = await streamFileContents(res, handle, range, res.socket);
        if (result) {
            logError("Failed to stream range", range, "due to:", result);
        }
        res.end();
        return;
    }

    // RFC 9910 states:
    // "A Content-Length header field present in a 206 response indicates
    // the number of octets in the content of this message, which is usually
    // not the complete length of the selected representation."
    // Whem just handling a single range, this is easy. Not so when
    // dealing with multiple ranges, as RFC 9910 15.3.7.2 demonstrates
    // that the whole body data (even the sub-headers) need to be included.

    const SEPERATOR_STRING = "RANGE_BOUNDARY";
    res.setHeader("Content-Type", `multipart/byteranges; boundary=${SEPERATOR_STRING}`);
    // RFC 2046 4.1.1:
    // "The canonical form of any MIME "text" subtype MUST always represent a line break as a CRLF sequence"
    // A string for computation
    let cmpStr = ``;
    const head = new Array<string>(ranges.length);
    for (let i = 0; i < ranges.length; i++) {
        const range = ranges[i];
        let str = "";
        str += `--${SEPERATOR_STRING}\r\n`;
        str += `Content-Type: ${handle.type}\r\n`;
        // There are two newlines before the actual content, and one after
        // Thus, there is none when inserting the seperator, nor when
        // inserting the final seperator.
        str += `Content-Range: bytes ${range.from}-${range.to}/${handle.size}\r\n\r\n`;
        cmpStr += str + "\r\n";
        head[i] = str;
    }
    cmpStr += `--${SEPERATOR_STRING}--`;
    const length = cmpStr.length + total;
    res.setHeader("Content-Length", length);

    // For a HEAD, we only need to send the content-length of the
    // combined parts and all the stuff we computed.
    if (isHeadRequest(req)) {
        res.end();
        return;
    }

    for (let i = 0; i < ranges.length; i++) {
        res.write(head[i]);
        const range = ranges[i];
        // streamFileContents closes the write stream, and thus, only
        // the PassThrough itself is closed and the response remains open
        const pass = new PassThrough();
        pass.pipe(res);
        const result = await streamFileContents(pass, handle, range, res.socket);
        if (result) {
            logError("Failed to stream range", range, "due to:", result);
            res.end();
            return;
        }
        res.write("\r\n");
    }
    res.write(`--${SEPERATOR_STRING}--`);
    res.end();
}
