import crypto, { getRandomValues, type BinaryLike } from "node:crypto";
import { createReadStream } from "node:fs";
import { getEnvironmentVariables } from "./environment.js";
import { logDebug } from "./logging.js";
import type { PrefixedUUID, UUIDPrefix } from "./index.js";

function createEncryptionKey() {
    const encodedKey = getEnvironmentVariables("discord").CRYPTO_KEY;
    return Buffer.from(encodedKey, "base64");
}

const algorithm = "aes-256-gcm";
let key: Buffer | null = null;

/**
 * Encrypts a buffer using AES symmetric encryption.
 *
 * Generates an IV, appends it to the beginning of the data
 * and returns a new buffer.
 */
export function encryptBuffer(data: Buffer) {
    key ??= createEncryptionKey();
    // For security reasons, every buffer has to have its own IV
    // This can be stored without issue at the beginning of the data
    const iv = crypto.randomBytes(16);
    // @ts-ignore
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    // By overwriting data, some memory should be saved
    // @ts-ignore
    data = Buffer.concat([iv, cipher.update(data), new Uint8Array(cipher.final())]);
    return data;
}

/**
 * Decrypts a buffer with the IV stored in its first 16 bytes.
 *
 * Uses the AES key stored in the enviroment variables.
 * @param data
 */
export function decryptBuffer(data: Buffer) {
    // AES chunks with 16 bytes (I think) and thus, when removing the
    // IV, we should always at least have 16 bytes.
    if (data.length < 0x20) throw new Error("Data to decrypt is smaller than IV size");

    key ??= createEncryptionKey();
    const iv = Uint8Array.prototype.slice.apply(data, [0x00, 0x10]);
    const ciphertext = Uint8Array.prototype.slice.apply(data, [0x10]);
    // @ts-ignore
    const decipher = crypto.createCipheriv(algorithm, key, iv);

    // @ts-ignore
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted;
}

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
