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
        return (size / divider).toFixed(1) + " " + FILE_SIZE_IDENTIFIERS[i];
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
 * Creates an array of map values and sorts them by the indices
 * of their keys inside another array passed to the function.
 *
 * This function fails if any of the keys inside the map are not
 * present within the list.
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

const nowRange = 60 * 1000;
const fullDay = 1000 * 60 * 60 * 24;
const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function parseDateObjectToRelative(obj: Date) {
    const pad = (input: number) => input.toString(10).padStart(2, "0");

    const obj2 = new Date();
    const n = obj2.getTime();
    const t = obj.getTime();
    const d = Math.abs(n - t);

    const isFuture = t > n;

    const time = `at ${pad(obj.getHours())}:${pad(obj.getMinutes())}`;
    const dayMonth = `${months[obj.getMonth()]} ${obj.getDate()}`;

    // If the delta is within a day range, we can just show the time
    if (d <= fullDay) {
        return time;
    }

    // If within a three day range, a day this week cannot overlap with a day
    // of the same name next week (too little distance)
    else if (d <= fullDay * 3) {
        return `${days[obj.getDay()]} ${time}`;
    }

    // If the date fell within this year, we don't show the year
    else if (obj.getFullYear() === obj2.getFullYear()) {
        return `${dayMonth} ${time}`;
    }

    return `${dayMonth}, ${obj.getFullYear()} ${time}`;
}
