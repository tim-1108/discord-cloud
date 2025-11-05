import { createResolveFunction } from "../common/useless.js";

const TIMEOUT_PER_CHUNK_IN_MS = 120_000 as const;

/**
 * Creates a promise with a timeout of the length {@link TIMEOUT_PER_CHUNK_IN_MS} in milliseconds.
 * When the timeout runs out, so the callback is executed, the promise **resolves** to `false`.
 * A promise that resolves to `true` means that `clear()` has been called to cancel the
 * timeout as a whole.
 * Use `lengthen()` to extend the the timeout back to the original timeout length.
 */
export function createTimeout() {
    const { promise, resolve } = createResolveFunction<boolean>();

    let timeout = setTimeout(() => resolve(false), TIMEOUT_PER_CHUNK_IN_MS);
    function lengthen(): void {
        clearTimeout(timeout);
        timeout = setTimeout(() => resolve(false), TIMEOUT_PER_CHUNK_IN_MS);
    }
    function clear(): void {
        clearTimeout(timeout);
        resolve(true);
    }

    return { promise, lengthen, clear };
}
