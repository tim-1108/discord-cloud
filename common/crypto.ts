import crypto, { type BinaryLike } from "node:crypto";
import { createReadStream } from "node:fs";

function createEncryptionKey() {
    const encodedKey = process.env.CRYPTO_KEY;
    if (!encodedKey) throw new ReferenceError("Cannot encrypt w/o key");
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
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    // By overwriting data, some memory should be saved
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
    const decipher = crypto.createCipheriv(algorithm, key, iv);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    console.info(`Decryption of size ${decrypted.length} took ${Date.now() - decryptionStart}ms`);
    return decrypted;
}

export function isEncryptionEnabled() {
    return process.env.ENCRYPTION === "1";
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