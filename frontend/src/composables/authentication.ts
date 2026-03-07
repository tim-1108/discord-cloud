import { deleteObjectFromStorage, LocalStorageKey, readObjectFromStorage, readRawFromStorage, writeObjectToStorage } from "./storage";
import { validateObjectBySchema, type SchemaToType } from "../../../common/validator";
import { Dialogs } from "./dialog";
import { Communicator } from "@/socket/Communicator";
import { patterns } from "../../../common/patterns";
import { logError, logInfo, logWarn } from "../../../common/logging";
import { createResolveFunction, sleep, type ResolveContainer } from "../../../common/useless";
import type { DataErrorFields } from "../../../common";
import { CommunicatorConnectionState } from "./state";

const authenticationSchema = {
    address: { type: "string", required: true, validator_function: validateSocketUrl },
    username: { type: "string", required: true, min_length: 1 },
    token: { type: "string", required: true, pattern: patterns.jwt }
} as const;
const previousAuthenticationSchema = {
    address: { type: "string", required: true, validator_function: validateSocketUrl },
    username: { type: "string", required: true, min_length: 1 },
    password: { type: "string", required: true }
} as const;
export type Credentials = SchemaToType<typeof authenticationSchema>;

function validateSocketUrl(input: any) {
    if (typeof input !== "string") return false;
    try {
        const object = new URL(input);
        return ["wss:", "ws:"].includes(object.protocol);
    } catch {
        return false;
    }
}

async function health(url: URL): Promise<boolean> {
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

/**
 * Returns a promise that only resolves when the `health()`
 * function with the provided URL actually fulfilled with `true`,
 * indicating that the server is online.
 */
async function continuousHealth(url: URL): Promise<void> {
    while (true) {
        const flag = await health(url);
        if (flag) return;
        await sleep(5000);
    }
}

/**
 * Takes in any string and attempts to run some fixes on it to determine
 * whether it can be parseed into a valid socket address. Returns a
 * `URL` object with the protocol either `ws:` or `wss:` depending on
 * that of the browser's location. If it fails, returns `null`.
 */
function getAndFixAddress(input: string): URL | null {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    let a = `${input.trim()}`;
    let u = URL.parse(a);

    // "localhost:4000" would get parsed as "localhost:" for protocol and "4000" as pathname.
    // Thus, we also require a host to just accept the raw input string as valid.
    if (u && u.host) {
        u.protocol = protocol;
        return u;
    }

    const hasProtocol = /^[^:]+:\/\//.test(a);
    // The url can still be parsed even if no protocol is specified (becomes relative)
    if (!hasProtocol) {
        a = `${protocol}//${a}`;
        u = URL.parse(a);
    }
    return u;
}

function destroyCommunicator() {
    stored_communicator = null;
}

function updateConnectionState(state: (typeof CommunicatorConnectionState)["value"]): void {
    CommunicatorConnectionState.value = state;
}

/**
 * Used when multiple callers may be requesting the communicator
 * at the same time. The first one calling `getOrCreateCommunicator()`
 * gets to do all the action whilst all the others will wait for this
 * promise to resolve to then return its value.
 *
 * Otherwise, multiple requests may go to `login()` and eventually
 * multiple instances of `Communicator` might get instantiated, only
 * to be replaced by another one within the `stored_communicator` var.
 */
let promised_communicator: Promise<Communicator> | null = null;
let stored_communicator: Communicator | null = null;
export async function getOrCreateCommunicator(): Promise<Communicator> {
    if (stored_communicator) {
        return stored_communicator;
    }

    if (promised_communicator) {
        return promised_communicator;
    }

    let auth = await getAuthentication();

    // If this isn't valid, we should really throw.
    // Everything that is getting written to the local
    // storage has to be validated beforehand.
    let url = new URL(auth.address);

    updateConnectionState("health");
    // health() takes in any url for the correct server and
    // modifies it to http(s): and removes all params.
    await continuousHealth(url);

    if (auth.existing) {
        updateConnectionState("verify");
        // There isn't really anything to do with the user id.
        const verification = await verify(auth.address, auth.token);
        if (verification.error !== null) {
            // FIXME: Why is this necessary???
            if ((verification.error as TokenVerifyError) !== TokenVerifyError.TokenInvalid) {
                // TODO: What do we do with you?
                throw new Error("Validation went wrong!");
            }
            auth = await getAuthentication({ username: auth.username, address: auth.address });
            url = new URL(auth.address);
        }
    }

    url.searchParams.append("type", "client");
    url.searchParams.append("key", auth.token);

    updateConnectionState("establishing");
    stored_communicator = new Communicator(url);
    return stored_communicator;
}

let resolver: ResolveContainer<Credentials> | null = null;
/**
 * If `predefinedCredentials` is passed, no data is retrieved from storage and
 * this object is passed to the login dialog.
 */
async function getAuthentication(predefinedCredentials?: { address: string; username: string }): Promise<Credentials & { existing?: boolean }> {
    const object = getAuthenticationSync();
    // Marks that the object was retrieved from storage.
    // This means that the token should be validated before
    // creating a socket.
    if (object && typeof predefinedCredentials === "undefined") {
        return { ...object, existing: true };
    }

    if (resolver !== null) {
        return resolver.promise;
    }

    const { promise, resolve } = createResolveFunction<Credentials>();
    resolver = { promise, resolve };

    void Dialogs.mount("login", { predefinedCredentials });

    const data = await promise;
    const validation = validateObjectBySchema(data, authenticationSchema);
    if (validation.invalid) {
        logError("Invalid authentication data:", data, "| offenses:", validation.offenses);
        throw new TypeError("Invalid data passed to the authentication resolver");
    }

    Dialogs.unmount("login");

    writeObjectToStorage(LocalStorageKey.Authentication, data);
    return data;
}

function getAuthenticationSync(): Credentials | null {
    const data = readObjectFromStorage(LocalStorageKey.Authentication, authenticationSchema);
    if (data) {
        return data;
    }
    // Now, there may either be nothing set, or the legacy data may still be active.
    const previousData = readObjectFromStorage(LocalStorageKey.Authentication, previousAuthenticationSchema);
    const token = readRawFromStorage(LocalStorageKey.Token, { type: "string", required: true, pattern: patterns.jwt });
    // This might just mean that there is not actually anything.
    if (token === null || previousData === null) {
        return null;
    }
    logInfo("Migrated legacy authentication storage");
    const migratedData = { username: previousData.username, address: previousData.address, token };
    writeObjectToStorage(LocalStorageKey.Authentication, migratedData);
    deleteObjectFromStorage(LocalStorageKey.Token);
    return migratedData;
}

async function getServerAddress(protocol: string = window.location.protocol): Promise<URL> {
    const auth = await getAuthentication();
    const obj = URL.parse(auth.address);
    if (!obj) {
        throw new ReferenceError("Invalid server address read in getServerAddress: " + auth.address);
    }
    obj.protocol = protocol;
    obj.pathname = "/";
    obj.hash = "";
    obj.search = "";
    return obj;
}

function resolve(username: string, token: string, address: URL) {
    if (!resolver) {
        throw new ReferenceError("Attempted to access the authentication resolver whilst it was not set");
    }
    resolver.resolve({ username, token, address: address.toString() });
}

function clearAuthentication(): void {
    deleteObjectFromStorage(LocalStorageKey.Authentication);
}

export enum LoginError {
    IncorrectCredentials,
    ServerError,
    Unknown,
    BadRequest,
    InvalidAddress
}

enum TokenVerifyError {
    TokenInvalid,
    ServerError,
    Unknown
}

async function verify(address: string, token: string): Promise<DataErrorFields<number, TokenVerifyError>> {
    const url = URL.parse(address);
    if (!url) {
        throw new Error("The address supplied to verify() is invalid");
    }
    url.pathname = "/token-status";
    url.protocol = window.location.protocol;
    url.search = "";
    url.searchParams.append("token", token);

    try {
        const r = await fetch(url);
        if (!r.ok) {
            const error =
                r.status === 401
                    ? TokenVerifyError.TokenInvalid
                    : r.status.toString().startsWith("5")
                      ? TokenVerifyError.ServerError
                      : TokenVerifyError.Unknown;
            return { data: null, error };
        }
        const { user_id } = await r.json();
        if (typeof user_id !== "number" || !Number.isSafeInteger(user_id) || user_id < 0) {
            logWarn('Expected field "userId" in response to be a valid number, got:', user_id);
            return { data: null, error: TokenVerifyError.ServerError };
        }
        return { data: user_id, error: null };
    } catch {
        return { data: null, error: TokenVerifyError.Unknown };
    }
}

async function login(username: string, password: string, address: string): Promise<DataErrorFields<string, LoginError>> {
    const url = URL.parse(address);
    if (!url) {
        return { data: null, error: LoginError.InvalidAddress };
    }
    url.pathname = "/login";
    url.protocol = window.location.protocol;
    url.search = "";
    const s = url.searchParams;
    s.append("username", username);
    s.append("password", password);

    try {
        const r = await fetch(url);
        if (!r.ok) {
            const error =
                r.status === 400
                    ? LoginError.BadRequest
                    : r.status === 403
                      ? LoginError.IncorrectCredentials
                      : r.status.toString().startsWith("5")
                        ? LoginError.ServerError
                        : LoginError.Unknown;
            return { data: null, error };
        }
        const { token } = await r.json();
        if (!patterns.jwt.test(token)) {
            logError("Invalid token shape", token);
            return { data: null, error: LoginError.ServerError };
        }
        return { data: token as string, error: null };
    } catch {
        return { data: null, error: LoginError.Unknown };
    }
}

export const Authentication = {
    login,
    getAndFixAddress,
    destroyCommunicator,
    resolve,
    health,
    getServerAddress,
    get: getAuthentication,
    getSync: getAuthenticationSync,
    clear: clearAuthentication
};
