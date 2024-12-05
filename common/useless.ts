export function formatJSON(object: any) {
    return JSON.stringify(object, null, 2);
}

export function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(() => resolve(null), ms));
}

export function escapeQuotes(text: string) {
    return text.replace(/"/g, '\\"');
}

const FILE_SIZE_IDENTIFIERS = ["TB", "GB", "MB", "KB", "B"];
const FILE_MULTIPLIER = 1024;
export function parseFileSize(size: number) {
    for (let i = FILE_SIZE_IDENTIFIERS.length - 1; i >= 0; i--) {
        const divider = Math.pow(FILE_MULTIPLIER, FILE_SIZE_IDENTIFIERS.length - i - 1);
        if (size / divider > FILE_MULTIPLIER) continue;
        return (size / divider).toFixed(1) + FILE_SIZE_IDENTIFIERS[i];
    }
}
