import { ref } from "vue";
import {
    deleteObjectFromStorage,
    LocalStorageKey,
    readObjectFromStorage,
    readRawFromStorage,
    writeObjectToStorage,
    writeRawToStorage
} from "./storage";
import type { SchemaToType } from "../../../common/validator";
import { Dialogs, type AlertDialogConfig } from "./dialog";
import { Communicator } from "@/socket/Communicator";
import { patterns } from "../../../common/patterns";
import { logError } from "../../../common/logging";
import { createResolveFunction, sleep } from "../../../common/useless";
import { PendingAuthenticationState } from "./state";

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
        Dialogs.mount("login", {});
        const result = await new Promise<Authentication>((resolve) => (resolver.value = resolve));
        Dialogs.unmount("login");
        writeObjectToStorage(LocalStorageKey.Authentication, result);
        return result;
    }
    return storedData;
}

export function clearAuthentication() {
    deleteObjectFromStorage(LocalStorageKey.Authentication);
    deleteObjectFromStorage(LocalStorageKey.Token);
}

async function isServerAvailable(url: URL): Promise<boolean> {
    // Cloned to not overwrite previously used url
    url = new URL(url);
    url.protocol = window.location.protocol;
    url.pathname = "/health";
    url.search = "";
    try {
        const response = await fetch(url);
        // The server returns a 204 on the /health endpoint when online
        return response.ok;
    } catch {
        return false;
    }
}

let stored_communicator: Communicator | null = null;
export async function getOrCreateCommunicator(): Promise<Communicator> {
    if (stored_communicator) {
        return stored_communicator;
    }
    let token = readRawFromStorage(LocalStorageKey.Token, { type: "string", required: true, pattern: patterns.jwt });
    const auth = await getAuthentication();

    let a = `${auth.address}`;
    let u = URL.parse(a);

    const hasProtocol = /^[^:]+:\/\//.test(a);
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    // The url can still be parsed even if no protocol is specified (becomes relative)
    if (!hasProtocol) {
        a = `${protocol}//${a}`;
        u = URL.parse(a);
    }

    // If still invalid, there may be too many edge cases to implement here
    if (!u) {
        const cfg: AlertDialogConfig = { body: `The server address you entered appears to be invalid: ${a}` };
        const { promise, resolve } = createResolveFunction();
        Dialogs.mount("alert", { cfg, callback: resolve });
        await promise;
        Dialogs.unmount("alert");

        throw new ReferenceError("Invalid address: " + a);
    }

    // @ts-expect-error is readonly due to "as const" typing of auth schema
    auth.address = u.toString();

    PendingAuthenticationState.value = "health";

    while (true) {
        const flag = await isServerAvailable(u);
        if (flag) break;
        await sleep(1000);
    }

    PendingAuthenticationState.value = "login";

    unauthed: if (!token) {
        const { error, data } = await performLogin(auth);
        if (data) {
            token = data;
            break unauthed;
        }

        const cfg: AlertDialogConfig = { body: `We could not log you in. Please log off or try again. Error: ${error}` };
        const { promise, resolve } = createResolveFunction();
        Dialogs.mount("alert", { cfg, callback: resolve });
        await promise;
        Dialogs.unmount("alert");
        throw new ReferenceError("Failed to login");
    }

    writeRawToStorage(LocalStorageKey.Token, token);

    PendingAuthenticationState.value = "establishing";

    u.searchParams.append("type", "client");
    u.searchParams.append("key", token);
    stored_communicator = new Communicator(u);
    return stored_communicator;
}

async function performLogin(authentication: Authentication) {
    try {
        const url = new URL(authentication.address);
        url.pathname = "/login";
        url.protocol = window.location.protocol;
        const s = url.searchParams;
        s.append("username", authentication.username);
        s.append("password", authentication.password);
        const r = await fetch(url);
        if (!r.ok) {
            const fn = r.headers.get("content-type") === "application/json" ? r.json : r.text;
            logError("Failed to perform login:", r.status, await fn());
            return { data: null, error: "Failed to login, status: " + r.status };
        }
        const { token } = await r.json();
        if (!patterns.jwt.test(token)) {
            logError("Invalid token shape", token);
            return { data: null, error: "Token is in invalid shape" };
        }
        return { data: token as string, error: null };
    } catch {
        return { data: null, error: "Failed to fetch" };
    }
}
