export interface UploadFileHandle {
    handle: File;
    relativePath: string;
}

function streamFromFile(file: File, chunkSize: number) {
    let buffer = new Uint8Array();
    const stream = file.stream();
    const reader = stream.getReader();

    async function readNextChunk(): Promise<{ data: Uint8Array, done: boolean }> {
        if (buffer.byteLength >= chunkSize) {
            const data = buffer.subarray(0, chunkSize);
            buffer = buffer.subarray(chunkSize);
            return { data, done: false };
        }

        while (true) {
            const { value, done } = await reader.read();

            if (done) { // if done, there is no value
                const data = buffer.subarray(0, chunkSize);
                // If we get unlucky, the last chunk of our stream sits between
                // thee second to last upload chunk and the remainder.
                if (buffer.byteLength > chunkSize) {
                    buffer = buffer.subarray(chunkSize);
                    return { data, done: false };
                }
                // once we're actually done, we clear all data
                // so - if this gets called accidentially again - the data is not returned twice
                // (this oughn't happen though)
                buffer = new Uint8Array();
                return { data, done: true };
            }

            const newBuffer = new Uint8Array(buffer.byteLength + value.byteLength);
            newBuffer.set(buffer, 0);
            newBuffer.set(value, buffer.byteLength);
            buffer = newBuffer;

            if (buffer.byteLength >= chunkSize) {
                const data = buffer.subarray(0, chunkSize);
                buffer = buffer.subarray(chunkSize);
                return { data, done: false };
            }
        }
    }

    return readNextChunk;
}

export function submitUpload(handle: UploadFileHandle) {

}
