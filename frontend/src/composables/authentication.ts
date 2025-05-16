import { ref } from "vue";
import { LocalStorageKey, readObjectFromStorage, writeObjectToStorage } from "./storage";
import { useSidebarState } from "./sidebar";
import type { SchemaToType } from "../../../common/validator";

const authenticationSchema = {
    address: { type: "string", required: true, validator_function: validateSocketUrl },
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
    const sidebarState = useSidebarState();
    if (!storedData) {
        // Might occurr if data should happen to be invalid
        localStorage.removeItem(LocalStorageKey.Authentication);
        sidebarState.value = "auth";
        const result = await new Promise<Authentication>((resolve) => (resolver.value = resolve));
        sidebarState.value = "default";
        writeObjectToStorage(LocalStorageKey.Authentication, result);
        return result;
    }
    sidebarState.value = "default";
    return storedData;
}
