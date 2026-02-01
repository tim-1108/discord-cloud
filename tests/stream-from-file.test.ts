import { expect, test } from "bun:test";
import { streamFromFile } from "../frontend/src/composables/stream-from-file";

// chunk size
const cs = 10 * 1024 * 1024 - 1024;

test("every possible file size", async () => {
    // We test this for logical values to detect issues with
    // the wrapping over of reading and especially at the border
    // between chunks.

    const sizes = [cs - 1, cs, cs + 1, cs + 2, 2 * cs - 1, 2 * cs, 2 * cs + 1];
    for (let size = 0; size <= 512; size++) {
        sizes.push(size);
    }
    for (const size of sizes) {
        console.log(`Attempting size: ` + size);
        const chunks = await runForSize(size);

        const chunkCount = Math.ceil(size / cs);
        const remainderBytes = size % cs;
        expect(chunks).toHaveLength(chunkCount);
        for (let i = 0; i < chunks.length; i++) {
            // if remainder bytes = 0 that means that the file fits perfectly within the chunks
            const desiredSize = i === chunkCount - 1 && remainderBytes !== 0 ? remainderBytes : cs;
            expect(chunks[i]).toHaveLength(desiredSize);
        }
        const reconstructedView = reconstrutBufferFromChunks(chunks, size);
        expect(reconstructedView).toHaveLength(size);
        expect(isSequenceIntact(reconstructedView)).toBeTrue();
    }
});

async function runForSize(size: number): Promise<Uint8Array[]> {
    // it does not matter what is inside the underlying buffer.
    const view = new Uint8Array(size);
    fillBufferWithSequence(view);
    const blob = new Blob([view]);
    const stream = streamFromFile(blob as File, cs);

    const chunks = new Array<Uint8Array>();
    while (true) {
        const { value, done } = await stream();
        if (done) break;
        chunks.push(value);
    }
    return chunks;
}

function fillBufferWithSequence(view: Uint8Array): void {
    for (let i = 0; i < view.length; i++) {
        // bitwise is faster than modulo (presumably)
        view[i] = i & 0xff;
    }
}

function isSequenceIntact(view: Uint8Array): boolean {
    for (let i = 0; i < view.length; i++) {
        if (view[i] !== (i & 0xff)) return false;
    }
    return true;
}

function reconstrutBufferFromChunks(chunks: Uint8Array[], size: number) {
    const view = new Uint8Array(size);
    let writtenBytes = 0;
    for (let i = 0; i < chunks.length; i++) {
        view.set(chunks[i], writtenBytes);
        writtenBytes += chunks[i].length;
    }
    return view;
}
