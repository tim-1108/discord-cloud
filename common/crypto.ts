import crypto, { type BinaryLike } from "node:crypto";
import { createReadStream } from "node:fs";
import type { PrefixedUUID, UUIDPrefix } from "./index.js";

export function createHashFromBinaryLike(value: BinaryLike) {
    return crypto.createHash("sha256").update(value).digest("hex");
}

export function createHashFromFile(path: string) {
    return new Promise<string | null>((resolve) => {
        const readStream = createReadStream(path);
        const hash = crypto.createHash("sha256");
        hash.setEncoding("hex");

        readStream.on("end", () => {
            hash.end();
            resolve(hash.read());
        });
        readStream.pipe(hash);
        readStream.on("error", () => resolve(null));
    });
}

export function createPrefixedUUID<T extends UUIDPrefix>(prefix: T): PrefixedUUID<T> {
    return `${prefix}:${crypto.randomUUID()}`;
}

type GetRandomValuesTypedArray =
    | typeof Int8Array
    | typeof Uint8Array
    | typeof Uint8ClampedArray
    | typeof Int16Array
    | typeof Uint16Array
    | typeof Int32Array
    | typeof Uint32Array;
export function getRandomNumber(type: GetRandomValuesTypedArray): number {
    // TODO: also support BigInt64Array and BigUint64Array
    const array = new type(1);
    crypto.getRandomValues(array);
    return array[0];
}
