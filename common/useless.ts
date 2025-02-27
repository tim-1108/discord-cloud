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

export function areAllEntriesDefined<T>(array: (T | undefined)[]): array is T[] {
    return !array.some((item) => typeof item === "undefined" || item === null);
}

export function createRecordFromKeyValueArrays<K extends readonly string[], V = any>(keys: K, values: V[]): { [Key in keyof K]: V } {
    if (keys.length !== values.length) {
        console.warn("[createRecordFromKeyValueArrays] Received arrays with two different lengths:", keys, values);
    }
    const record = {} as { [Key in keyof K]: V };
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i] as keyof K;
        record[key] = values[i];
    }
    return record;
}

/**
 * This function is stupid.
 * TODO: Document this thing at some point.
 */
export function sortMapValuesAsArrayByKeyArray<K, V>(map: Map<K, V>, keys: K[]): V[] | null {
    const list = new Array<V>(map.size);
    for (const [key, value] of map) {
        const index = keys.indexOf(key);
        // If so, this failed.
        if (index === -1) return null;
        list[index] = value;
    }
    return list;
}
