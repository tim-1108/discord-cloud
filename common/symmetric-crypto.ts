import crypto from "node:crypto";
export const SymmetricCrypto = {
    initialize,
    encrypt,
    decrypt
} as const;

const schema = "aes-256-gcm" as const;
let keyBuffer: Buffer;
function initialize(base64encodedKeyBuffer: string) {
    const buffer = Buffer.from(base64encodedKeyBuffer, "base64");
    if (buffer.byteLength !== 32) {
        throw new TypeError("The AES key must be 32 bytes in length");
    }
    keyBuffer = buffer;
}

/**
 * Decrypts a `Buffer` with the key supplied previously via `initialize()`
 * using the `aes-256-gcm` algorithm. The initialisation vector is expected
 * to be stored within the first 16 bytes of the input buffer.
 *
 * This function should only be used with data from `encrypt()` and arbitary
 * user input should have its length validated beforehand to exceed 16 bytes.
 *
 * The input buffer is not overwritten - its length is likely different and
 * even updating the pointer to another memory section could confuse the caller.
 */
function decrypt(buffer: Buffer): Buffer {
    if (!keyBuffer) {
        throw new ReferenceError("initialize() was not called before calling decrypt() on SymmetricCrypto");
    }
    if (buffer.byteLength < 0x20) {
        throw new Error(`The inputted buffer has a length smaller than the IV size: ${buffer.toHex()}`);
    }
    // Buffer.prototype.slice is deprecated and incompatible with Uint8Array
    const iv = Uint8Array.prototype.slice.apply(buffer, [0x00, 0x10]);
    const ciphertext = Uint8Array.prototype.slice.apply(buffer, [0x10]);

    const cipher = crypto.createDecipheriv(schema, keyBuffer, iv);
    const a = cipher.update(ciphertext);
    const b = cipher.final();
    const plaintext = b.byteLength > 0 ? Buffer.concat([a, b]) : a;
    return plaintext;
}

/**
 * Encrypts a `Buffer` with the key supplied previously via `initialize()`
 * using the `aes-256-gcm` algorithm. The buffer returned includes the
 * randomly generated initialisation vector within the first 16 bytes, with
 * the remainder consisting of the ciphertext.
 *
 * The input buffer is not overwritten - its length is likely different and
 * even updating the pointer to another memory section could confuse the caller.
 */
function encrypt(buffer: Buffer): Buffer {
    if (!keyBuffer) {
        throw new ReferenceError("initialize() was not called before calling decrypt() on SymmetricCrypto");
    }
    // With 16 bytes, no IV should ever overlap. If they do,
    // the key might become compromised. (~3^38 possibilities)
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(schema, keyBuffer, iv);

    const a = cipher.update(buffer);
    const b = cipher.final();
    const ciphertext = Buffer.concat([iv, a, b]);
    return ciphertext;
}
