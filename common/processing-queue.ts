import { createResolveFunction } from "./useless.js";

/**
 * The amount of currently active processes
 */
let count = 0;
const MAX_COUNT = 3;
const queue = new Array<Function>();

export function enqueue(): Promise<void> {
    if (count < MAX_COUNT) {
        count++;
        return Promise.resolve();
    }

    const { promise, resolve } = createResolveFunction();

    queue.push(resolve);
    return promise;
}

export function shiftQueue() {
    const next = queue.shift();
    count = Math.max(count - 1, 0);
    if (next) {
        next();
    }
}
