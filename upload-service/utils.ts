import { createHashFromBinaryLike } from "../common/crypto.js";

/**
 * @param i Chunk index
 * @param s Total size of the file
 * @param cs Chunk size (10mb)
 * @param cc Chunk count
 */
export function getChunkSizeAtIndex(i: number, s: number, cs: number, cc: number) {
    if (cc === 1) {
        return s;
    }

    if (i < cc - 1) {
        return cs;
    }
    // The last chunk is just the remainder
    return s % cs;
}

export function combineHashes(array: string[]) {
    const concatenated = array.join("");
    return createHashFromBinaryLike(concatenated);
}
