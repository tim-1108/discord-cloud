import { validateObjectBySchema, type SchemaEntryConsumer, type SchemaToType, type StringSchemaEntry } from "../../../common/validator";
import { destr } from "destr";

export function readObjectFromStorage<T extends SchemaEntryConsumer>(key: LocalStorageKey, consumer: T): SchemaToType<typeof consumer> | null {
    const rawString = localStorage.getItem(key);
    if (rawString === null) return null;
    const data = destr<SchemaToType<typeof consumer>>(rawString);
    if (!validateObjectBySchema(data, consumer)) {
        return null;
    }

    return data;
}

export function readRawFromStorage(key: LocalStorageKey, schema?: StringSchemaEntry) {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    // keys have to match
    if (schema && !validateObjectBySchema({ value: raw }, { value: schema })) {
        return null;
    }

    return raw;
}

export function writeRawToStorage(key: LocalStorageKey, data: string): void {
    localStorage.setItem(key, data);
}

export function writeObjectToStorage(key: LocalStorageKey, data: any): void {
    localStorage.setItem(key, JSON.stringify(data));
}

export function deleteObjectFromStorage(key: LocalStorageKey) {
    return localStorage.removeItem(key);
}

export enum LocalStorageKey {
    Authentication = "discord-cloud-authentication",
    Token = "discord-cloud-token"
}
