import { validateObjectBySchema, type SchemaEntryConsumer, type SchemaToType } from "../../../common/validator";
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

export function writeObjectToStorage(key: LocalStorageKey, data: any): void {
    localStorage.setItem(key, JSON.stringify(data));
}

export enum LocalStorageKey {
    Authentication = "discord-cloud-authentication"
}
