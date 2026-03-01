import crypto from "node:crypto";
import { logDebug, logWarn } from "./logging.js";
import { createHashFromBinaryLike } from "./crypto.js";
export const SymmetricCrypto = {
    initialize,
    encrypt,
    decrypt,
    decryptLegacy
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
 * to be stored within the first 16 bytes of the input buffer. The next
 * 16 bytes are the auth tag, with the remainder being the ciphertext.
 *
 * This function should only be used with data from `encrypt()` and arbitary
 * user input should have its length validated beforehand to exceed 32 bytes.
 * Otherwise, `null` will be returned.
 *
 * If the iv, the auth tag or the ciphertext have been messed with, Node's
 * `DecipherIV`'s `final()` method will throw an error as the data decrypted
 * does not match what was encrypted. In such a case, `null` is returned.
 *
 * The input buffer is not overwritten - its length is likely different and
 * even updating the pointer to another memory section could confuse the caller.
 */
function decrypt(buffer: Buffer): Buffer<ArrayBuffer> | null {
    if (!keyBuffer) {
        throw new ReferenceError("initialize() was not called before calling decrypt() on SymmetricCrypto");
    }
    if (buffer.byteLength < 0x20) {
        logWarn(`The inputted buffer has a length smaller than the IV and auth tag size: ${buffer.toHex()}`);
        return null;
    }
    // Buffer.prototype.slice is deprecated and incompatible with Uint8Array
    const iv = Uint8Array.prototype.slice.apply(buffer, [0x00, 0x10]);
    const authTag = Uint8Array.prototype.slice.apply(buffer, [0x10, 0x20]);
    const ciphertext = Uint8Array.prototype.slice.apply(buffer, [0x20]);

    logDebug("Decryption | Key:", keyBuffer, "| IV:", iv, "Auth:", authTag);
    logDebug("Hash:", createHashFromBinaryLike(buffer));

    const cipher = crypto.createDecipheriv(schema, keyBuffer, iv);
    cipher.setAuthTag(authTag);
    const a = cipher.update(ciphertext);
    // This only exists if there is some data remaining within the
    // cipher which is not returned via cipher.update().
    let b: Buffer;
    try {
        b = cipher.final();
    } catch {
        // The auth tag, the ciphertext or iv have been messed with
        return null;
    }
    const plaintext = b.byteLength > 0 ? Buffer.concat([a, b]) : a;
    return plaintext;
}

/**
 * This is a implementation of `decrypt()` to handle legacy ciphertexts, which were
 * still encrypted using AES-256 GCM and the same key, but without ever saving or
 * verifying the auth tag. This should only be used for verifying Discord attachments
 * saved as such, as those are unlikely to be messed with. Signed downloads should
 * never be respected like this - they may be tampered.
 */
function decryptLegacy(buffer: Buffer): Buffer<ArrayBuffer> {
    if (!keyBuffer) {
        throw new ReferenceError("initialize() was not called before calling decryptLegacy() on SymmetricCrypto");
    }
    if (buffer.byteLength < 0x10) {
        throw new Error(`The inputted buffer has a length smaller than the IV size: ${buffer.toHex()}`);
    }
    // Buffer.prototype.slice is deprecated and incompatible with Uint8Array
    const iv = Uint8Array.prototype.slice.apply(buffer, [0x00, 0x10]);
    const ciphertext = Uint8Array.prototype.slice.apply(buffer, [0x10]);

    // Decrypting the ciphertext using the encryption class just
    // somehow always worked... This is not intended whatsoever.
    const cipher = crypto.createCipheriv(schema, keyBuffer, iv);
    const a = cipher.update(ciphertext);
    const b = cipher.final();
    const plaintext = b.byteLength > 0 ? Buffer.concat([a, b]) : a;
    return plaintext;
}

/**
 * Encrypts a `Buffer` with the key supplied previously via `initialize()`
 * using the `aes-256-gcm` algorithm. The buffer returned includes the
 * randomly generated initialisation vector within the first 16 bytes, with
 * the remainder consisting of the ciphertext. The next 16 bytes are the
 * auth tag used on decryption. The remainder of the buffer from 0x20 onwards
 * is the actual ciphertext.
 *
 * The input buffer is not overwritten - its length is likely different and
 * even updating the pointer to another memory section could confuse the caller.
 */
function encrypt(buffer: Buffer): Buffer {
    if (!keyBuffer) {
        throw new ReferenceError("initialize() was not called before calling encrypt() on SymmetricCrypto");
    }
    // With 16 bytes, no IV should ever overlap. If they do,
    // the key might become compromised. (~3^38 possibilities)
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(schema, keyBuffer, iv);

    const a = cipher.update(buffer);
    const b = cipher.final();
    const authTag = cipher.getAuthTag();
    if (authTag.byteLength !== 0x10) {
        throw new Error(`Auth tag does not have valid length, expected 16 bytes, got ${authTag.byteLength}`);
    }
    const ciphertext = Buffer.concat([iv, authTag, a, b]);
    //logDebug("Key:", keyBuffer, "| IV:", iv, "Auth:", authTag);
    //logDebug("Hash:", createHashFromBinaryLike(ciphertext));
    return ciphertext;
}
