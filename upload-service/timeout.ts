const REQUEST_TIMEOUT_MS_PER_CHUNK = 60_000 as const;

let timeout: Timer | null = null;
let resolveFunc: Function | null = null;

/**
 * Starts the initial request timeout which resolves to a Promise
 * after {@link REQUEST_TIMEOUT_MS_PER_CHUNK} ms.
 *
 * Resolves with whether the timeout was actually reached.
 * If false, something else canceled this without exceeding the timeout
 * @param chunkCount The amount of chunks to determine whether to even start a timeout (though it should never be 0)
 */
export function startRequestTimeout(chunkCount: number): Promise<boolean> {
    if (!chunkCount) {
        return Promise.resolve(true);
    }
    return new Promise((resolve) => {
        resolveFunc = resolve;
        timeout = setTimeout(resolveTimeout, REQUEST_TIMEOUT_MS_PER_CHUNK);
    });
}

/**
 * Clears the resolve function of the timeout.
 * @param wasTimeoutReached Do not pass this as true when calling from outside the timeout itself
 */
export function resetRequestTimeout(wasTimeoutReached: boolean = false) {
    if (timeout) clearTimeout(timeout);
    if (resolveFunc) resolveFunc(wasTimeoutReached);
    timeout = null;
    resolveFunc = null;
}

export function lengthenTimeout() {
    if (!timeout || !resolveFunc) {
        console.warn("[Timeout] Failed to renew timeout");
        return;
    }
    clearTimeout(timeout);
    timeout = setTimeout(resolveTimeout, REQUEST_TIMEOUT_MS_PER_CHUNK);
    console.info("[Timeout] Lengthened");
}

/**
 * When this function is called, the time has run down
 *
 * => Request has failed
 *
 * (Used in setTimeout)
 */
function resolveTimeout() {
    if (!resolveFunc) return;
    resolveFunc(true);
}
