export type StreamFromFileReturn = { value: Uint8Array<ArrayBuffer>; done: false } | { value: undefined; done: true };

export function streamFromFile(file: File, chunkSize: number, abortController?: AbortController) {
    /**
     * A buffer in which we write the data we have read from the stream.
     * If the buffer size exceeds the
     */
    let buffer = new Uint8Array();
    let remainder = file.size;
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
        remainder = remainder - chunkSize;
        // There is already enough data stored within the buffer,
        // we can just return the asked for amount from there.
        if (buffer.byteLength >= chunkSize) {
            const value = buffer.subarray(0, chunkSize);
            buffer = buffer.subarray(chunkSize);
            return { value, done: false };
        }

        while (true) {
            const { value, done } = await reader.read();
            // If we actually just aborted this thing, we might as well
            // just stop now instead of building the whole buffer. The
            // caller will not do anything with this buffer anyhow.
            // This is only done here as all other operations occurr sync.
            if (signal?.aborted) return { value: undefined, done: true };

            if (done) {
                // if done, there is no value
                // thus, we just take everything we have stored
                const value = buffer.subarray(0, chunkSize);
                // If we get unlucky, the last chunk of our stream.read sits between
                // the second to last upload chunk and the remainder.
                // In such a case, this function will get called again for
                // the final chunk and then all the remainder will be returned

                if (remainder <= 0) {
                    // The last chunk typically is not as long as the default chunk length,
                    // thus the remainder variable will be less than 0.
                    buffer = buffer.subarray(value.length);
                    return { value, done: false };
                }
                // once we're actually done, we clear all data
                // so - if this gets called accidentially again - the data is not returned twice
                // (this oughn't happen though)
                buffer = new Uint8Array();
                return { value: undefined, done: true };
            }

            const newBuffer = new Uint8Array(buffer.byteLength + value.byteLength);
            // appending both buffers
            newBuffer.set(buffer, 0);
            newBuffer.set(value, buffer.byteLength);
            buffer = newBuffer;

            // We have just read a chunk from the stream and all the accumulated
            // data is enough to return a finished chunk!
            if (buffer.byteLength >= chunkSize) {
                const value = buffer.subarray(0, chunkSize);
                buffer = buffer.subarray(chunkSize);
                return { value, done: false };
            }
        }
    }

    return readNextChunk;
}
