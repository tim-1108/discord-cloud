export type StreamFromFileReturn = { value: Uint8Array<ArrayBuffer>; done: false } | { value: undefined; done: true };

export function streamFromFile(file: File, chunkSize: number, abortController?: AbortController) {
    /**
     * A buffer in which we write the data we have read from the stream.
     * If the buffer size exceeds the
     */
    let buffer = new Uint8Array();
    // Used for when the buffer has been fully read, but there
    // still is data within the internal buffer of this function
    // (so the user calls it again to retrieve it).
    let hasFinishedStream = false;
    const stream = file.stream();
    const reader = stream.getReader();

    const signal = abortController?.signal;

    /**
     * Returns the next chunk with the previously inputted {@link chunkSize} or the remainder.
     * If done, no value is returned anymore. "done: true" is only emitted after the final
     * chunk has been read (similar to using a ReadableStreamReader).
     *
     * If the abort controller's signal has `aborted` set to true whilst this function is
     * reading from the stream, it will return `done: true` regardless of whether it has
     * any data within its buffer.
     */
    async function readNextChunk(): Promise<StreamFromFileReturn> {
        function clipChunkOrLessFromBuffer() {
            const value = buffer.subarray(0, chunkSize);
            buffer = buffer.subarray(chunkSize);
            return value;
        }

        if (hasFinishedStream) {
            if (buffer.byteLength === 0) {
                return { value: undefined, done: true };
            }
            const value = clipChunkOrLessFromBuffer();
            return { value, done: false };
        }

        // There is already enough data stored within the buffer,
        // we can just return the asked for amount from there.
        if (buffer.byteLength >= chunkSize) {
            const value = clipChunkOrLessFromBuffer();
            return { value, done: false };
        }

        while (true) {
            // We don't count how much data we got from the reader
            // because we just have to trust it anyhow.
            const { value, done } = await reader.read();
            // If we actually just aborted this thing, we might as well
            // just stop now instead of building the whole buffer. The
            // caller will not do anything with this buffer anyhow.
            // This is only done here as all other operations occur sync.
            if (signal?.aborted) return { value: undefined, done: true };

            if (done) {
                // Ok, we are actually done. There is no data left.
                // This is very unlikely to happen.
                if (buffer.byteLength === 0) {
                    return { value: undefined, done: true };
                }

                hasFinishedStream = true;
                const value = clipChunkOrLessFromBuffer();
                return { value, done: false };
            }

            const newBuffer = new Uint8Array(buffer.byteLength + value.byteLength);
            // appending both buffers
            newBuffer.set(buffer, 0);
            newBuffer.set(value, buffer.byteLength);
            buffer = newBuffer;

            // We have just read a chunk from the stream and all the accumulated
            // data is enough to return a finished chunk!
            if (buffer.byteLength >= chunkSize) {
                const value = clipChunkOrLessFromBuffer();
                return { value, done: false };
            }
        }
    }

    return readNextChunk;
}
