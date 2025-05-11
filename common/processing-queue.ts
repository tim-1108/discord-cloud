let currentlyProcessing = false;
const queue = new Array<Function>();

export async function enqueue(): Promise<void> {
    if (!currentlyProcessing) {
        currentlyProcessing = true;
        return;
    }

    let resolveFunc: Function;
    const promise = new Promise<void>((resolve) => (resolveFunc = resolve));

    queue.push(resolveFunc!);
    return promise;
}

export function shiftQueue() {
    const next = queue.shift();
    if (!next) {
        currentlyProcessing = false;
        return;
    }
    next();
}
