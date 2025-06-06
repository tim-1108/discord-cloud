import { ref } from "vue";
import { deleteObjectFromStorage, LocalStorageKey, readObjectFromStorage, writeObjectToStorage } from "./storage";
import type { SchemaToType } from "../../../common/validator";
import { Dialogs } from "./dialog";

const authenticationSchema = {
    address: { type: "string", required: true, validator_function: validateSocketUrl },
    username: { type: "string", required: true },
    password: { type: "string", required: true, min_length: 1 }
} as const;
type Authentication = SchemaToType<typeof authenticationSchema>;

function validateSocketUrl(input: any) {
    if (typeof input !== "string") return false;
    try {
        const object = new URL(input);
        return ["wss:", "ws:"].includes(object.protocol);
    } catch {
        return false;
    }
}

const resolver = ref<((data: Authentication) => void) | null>(null);

export function resolvePromise(data: Authentication) {
    if (!resolver.value) return false;
    resolver.value(data);
    return true;
}

/**
 * Use only if you do not wish to prompt for authentication.
 */
export function getAuthenticationSync(): Authentication | null {
    return readObjectFromStorage(LocalStorageKey.Authentication, authenticationSchema);
}

export async function getAuthentication(): Promise<Authentication> {
    const storedData = readObjectFromStorage(LocalStorageKey.Authentication, authenticationSchema);
    if (!storedData) {
        // Might occurr if data should happen to be invalid
        localStorage.removeItem(LocalStorageKey.Authentication);
        Dialogs.mount("login");
        const result = await new Promise<Authentication>((resolve) => (resolver.value = resolve));
        Dialogs.unmount("login");
        writeObjectToStorage(LocalStorageKey.Authentication, result);
        return result;
    }
    return storedData;
}

export function clearAuthentication() {
    deleteObjectFromStorage(LocalStorageKey.Authentication);
}
