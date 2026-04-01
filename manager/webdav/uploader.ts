import type { OpenWriteStreamInfo, Path } from "webdav-server/lib/index.v2";
import { logInfo } from "../../common/logging";
import { duplexPair, PassThrough, Writable } from "node:stream";
import { Uploads } from "../uploads.js";
import { isUint8Array } from "node:util/types";

export function createDAVWriteStream(path: Path, ctx: OpenWriteStreamInfo): Writable {
    logInfo(path.toString(), ctx.estimatedSize, ctx.mode, ctx.targetSource);

    let index = 0;
    const cs = Uploads.chunkSize();
    const onlyOneChunk = ctx.estimatedSize <= cs;
    const [writable, readable] = duplexPair({ highWaterMark: cs });
    let buffer = Buffer.alloc(0);
    readable.on("data", (chunk) => {
        if (!isUint8Array(chunk)) {
            throw new TypeError("Expected to receive a Buffer object when reading a chunk");
        }

        const totalSize = buffer.byteLength + chunk.byteLength;
        if (totalSize < cs && !onlyOneChunk) {
            buffer = Buffer.concat([buffer, chunk]);
            return;
        }

        const output = Buffer.concat([buffer, chunk.slice(0, cs - buffer.byteLength)]);
        buffer = Buffer.from(chunk.slice(cs - buffer.byteLength - 1));
        console.log(index, output.byteLength);
        index++;
    });

    readable.on("end", () => {
        const cs = Uploads.chunkSize();
        while (buffer.byteLength > 0) {
            const output = buffer.subarray(0, cs);
            buffer = buffer.subarray(cs);
            console.log(index, output.byteLength);
            index++;
        }
    });

    return writable;
}
