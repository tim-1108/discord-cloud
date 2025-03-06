import type { Request } from "express";
import { logInfo } from "../common/logging";

const queue = new Array<Function>();
let currentlyProcessing = false;

export async function queueRequest(req: Request) {
    if (!currentlyProcessing) {
        currentlyProcessing = true;
        return;
    }

    let resolveFunc: Function;
    const promise = new Promise((resolve) => (resolveFunc = resolve));

    console.log("[Queue] Awaiting a new request to", req.url);
    queue.push(resolveFunc!);
    return promise;
}

export function nextRequest() {
    const next = queue.shift();
    if (!next) {
        currentlyProcessing = false;
        return;
    }
    next();
}
