import crypto, { type BinaryLike } from "node:crypto";
import { createReadStream } from "node:fs";
import { getEnvironmentVariables } from "./environment.js";
import { logDebug } from "./logging.js";

function createEncryptionKey() {
    const encodedKey = getEnvironmentVariables("common").CRYPTO_KEY;
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
    if (data.length < 0x10) throw new Error("Data to decrypt is smaller than IV size");

    const decryptionStart = Date.now();
    key ??= createEncryptionKey();
    const iv = Uint8Array.prototype.slice.apply(data, [0x00, 0x10]);
    const ciphertext = Uint8Array.prototype.slice.apply(data, [0x10]);
    // @ts-ignore
    const decipher = crypto.createCipheriv(algorithm, key, iv);

    // @ts-ignore
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    logDebug("Decryption of size", decrypted.length, "took", Date.now() - decryptionStart, "ms");
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
