import FormData from "form-data";
import { logDebug, logError } from "./logging.js";
import { sleep } from "./useless.js";
import type { DataErrorFields } from "./index.js";

export const Discord = {
    bot: {
        sendMessage: sendMessageWithAttachment,
        getMessages
    },
    cdn: {
        fetch: fetchRemoteBuffer
    },
    initialize: setBotToken
} as const;

let botToken: string;
function setBotToken(token: string) {
    botToken = token;
}

function assertToken() {
    if (!botToken) {
        throw new ReferenceError("The bot token has not been set yet");
    }
}

/**
 * Maps a message id to a signed link url. As obtaining a fresh signed attachment
 * link requires fetching the message object from the API, this step can be skipped
 * so long as the link has not yet expired.
 *
 * When reading from this table, assure that this timestamp has not yet been reached.
 * If so, invalidate the entry within here.
 */
const attachmentLinkCache = new Map<string, string>();
/**
 * A seconds value on the amount of time that is subtracted from the expiry
 * timestamp to make sure the attachment link does not expire right at the moment
 * the server attempts to actually download it. This has a very low chance of
 * actually happening. If it does, the server should consider re-obtaining such
 * a link - or check right upon sending the request.
 */
const ATTACHMENT_EXPIRE_PADDING = 60 as const;
const API_BASE = "https://discord.com/api/v10" as const;
/**
 * A maximum of 100 messages may be fetched at a time from the Discord API
 */
const MESSAGE_FETCH_LIMIT = 100;

async function getMessages(input: string[], channel: string) {
    input = structuredClone(input);
    // attachment url map
    const a = new Map<string, string>();

    for (let i = input.length - 1; i >= 0; i--) {
        const msg = input[i];
        const hit = attachmentLinkCache.get(msg);
        if (!hit) {
            continue;
        }
        if (hasAttachmentExpired(hit)) {
            attachmentLinkCache.delete(msg);
            continue;
        }
        a.set(msg, hit);
        input.splice(i, 1);
    }

    if (input.length === 0) {
        // Every message might have already been consumed by the cache
        return { data: a, error: null };
    }

    if (input.length === 1) {
        const msg = await fetchIndividualMessage(channel, input[0]);
        if (!msg.data) {
            return { data: null, error: "Failed to fetch all messages" };
        }
        if (msg.data.id !== input[0]) {
            throw new TypeError("Returned msg id does not match requested id");
        }
        const link = extractAttachmentLinkFromMessage(msg.data);
        a.set(msg.data.id, link);
        attachmentLinkCache.set(msg.data.id, link);
        return { data: a, error: null };
    }

    const sortedMessageIds = sortMessages(input);

    const stats = {
        bulk: 0,
        individual: 0
    };

    // When fetching messages in bulk, we do not know whether they have been
    // send directly after each other. (might be true, but also might not be)
    // -> that property cannot be just read from the ids alone.
    // Thus, we'll just start with the latest message, fetch a lot of 'em
    // and look which we have just collected.
    // (We do not fetch by chunk id, as the user is choosing the upload order)

    // If we have more than 100 chunks, we need to fetch at least twice
    // This is highly fluctuant, but by just wildly doubling the amount of runs
    // we do, we tend to fetch many more messages if they are further spread apart.
    // We'd rather do 10 mostly useless runs instead of doing 100 individual fetches.
    let neededRuns = Math.ceil(sortedMessageIds.length / MESSAGE_FETCH_LIMIT) * 2;

    while (neededRuns > 0 && sortedMessageIds.length > 0) {
        const newestMsg = sortedMessageIds[sortedMessageIds.length - 1];
        // By using the "before" param on the discord api, the message itself is never fetched by bulk
        const response = await fetchMessages(channel, newestMsg, sortedMessageIds);
        if (!response.data) {
            logDebug("Failed to fetch bulk messages due to:", response.error);
            return { data: null, error: "Failed to fetch all messages" };
        }
        for (const { link, id } of response.data) {
            a.set(id, link);
        }
        const individual = await fetchIndividualMessage(channel, newestMsg);
        if (!individual.data) {
            logDebug("Failed to fetch individual last message due to:", individual.error);
            return { data: null, error: "Failed to fetch all messages" };
        }
        const link = extractAttachmentLinkFromMessage(individual.data);
        a.set(individual.data.id, link);
        attachmentLinkCache.set(individual.data.id, link);
        stats.individual++;
        // Negative indices in Array.prototype.splice also go from
        // the end of the array (not behaviour we want, although it
        // should be impossible to occurr in this circumstance as the
        // response length should never be greater than $msgs')
        // CRITICAL: As we use "before" param, we can never fetch
        //           the last message using bulk
        const targetIndex = Math.max(sortedMessageIds.length - response.data.length - 1, 0);
        // as we now also have fetched the last message individually, we can splice it off as well
        sortedMessageIds.splice(targetIndex);

        stats.bulk += response.data.length;
        neededRuns--;
    }

    // Everything that is left is fetched this way...
    for (const msg of sortedMessageIds) {
        const response = await fetchIndividualMessage(channel, msg);
        if (!response.data) {
            logDebug("Failed to fetch individual message", msg, "due to:", response.error);
            return { data: null, error: "Failed to fetch all messages" };
        }
        stats.individual++;
        const link = extractAttachmentLinkFromMessage(response.data);
        a.set(response.data.id, link);
        attachmentLinkCache.set(response.data.id, link);
    }

    logDebug("Fetched with these stats:", stats);
    return { data: a, error: null };
}

interface FetchConfig {
    /**
     * A subpath of {@link API_BASE}.
     */
    target: string | URL;
    method: "GET" | "POST" | "PATCH";
    retryCount: number;
    form?: FormData;
    headers?: Record<string, string>;
}
type FetchToDiscordApiReturn<R> = { data: R; error: null } | { data: null; error: string };
/**
 * Performs an authenticated fetch (using the supplied bot token via `setBotToken()`) to the Discord API with the given address
 */
async function fetchToDiscordApi<R>(cfg: FetchConfig): Promise<FetchToDiscordApiReturn<R>> {
    assertToken();
    const $url = cfg.target instanceof URL ? cfg.target : URL.parse(cfg.target);

    // If somehow user-inputted data is inserted as url, the target should never
    // lie outside the Discord api, as that might lead to them obtaining the token
    // supplied in the Authorization header.
    if ($url === null || $url.host !== "discord.com" /* deliberatly using .host to include port */ || !$url.toString().startsWith(API_BASE)) {
        logDebug("Invalid Discord API url:", cfg.target);
        return { data: null, error: "An invalid Discord API address was specified" };
    }
    if (cfg.method === "GET" && cfg.form) {
        throw new TypeError("Cannot supply a body when GETting to Discord");
    }
    const headers = { ...cfg.form?.getHeaders(), Authorization: `Bot ${botToken}`, ...cfg.headers };
    let attempts = 0;
    while (true) {
        attempts++;
        if (attempts >= cfg.retryCount) {
            logDebug(`Fail [${cfg.target}]: Maximum retries exceeded`);
            return { data: null, error: "Maximum retries exceeded" };
        }
        let response: Response;
        try {
            response = await fetch(cfg.target, { method: cfg.method, headers, body: cfg.form?.getBuffer().buffer as ArrayBuffer | undefined });
        } catch (error) {
            // If an error is thrown here, it means a NetworkError or "Failed to fetch" occurred.
            // This means the request itself failed, not that something like 429's were returned.
            // If so, there is most likely no actual point in retrying (we can assume some network
            // failure that won't just fix itself). On cloud systems, that should be very rare.
            logError("A fetch to Discord failed", cfg, error);
            return { data: null, error: "Failed to fetch" };
        }
        if (response.ok) {
            // The discord API is supposed to only return JSON data
            if (response.headers.get("content-type") !== "application/json") {
                return { data: null, error: "Incorrect content type" };
            }
            // Even on 2xx requests, this header is present, and if a timeout
            // is looming (there are no more allowed requests) we pause for
            // the required amount of time. Note that this produces a slight
            // inefficiency as if the last request performed is hitting r = 0,
            // we still sleep despite us technically not needing to do so.
            const remaining = getNumberHeader(response, "X-RateLimit-Remaining");
            if (remaining === 0) {
                const seconds = getNumberHeader(response, "X-RateLimit-Reset-After") ?? 0;
                await sleep(Math.max(seconds, 0));
            }

            return new Promise((resolve) =>
                response
                    .json()
                    .then((data) => resolve({ data: data as R, error: null }))
                    .catch(() => resolve({ data: null, error: "Failed to parse JSON" }))
            );
        }
        if (response.status !== 429) {
            const msgHandler = response.headers.get("Content-Type") === "application/json" ? response.json : response.text;
            try {
                const msg = await msgHandler();
                logDebug(`Fail [${cfg.target}]:`, response.status, msg);
            } catch {
                logDebug(`Fail [${cfg.target}]:`, response.status);
            }
            return { data: null, error: "Failed to fetch due to " + response.status };
        }

        // https://discord.com/developers/docs/topics/rate-limits#header-format
        const isGlobal = response.headers.get("X-RateLimit-Global") === "true";
        if (isGlobal) {
            return { data: null, error: "Encountered a global rate limit on the Discord API" };
        }

        const r = response.headers.get("Retry-After");
        if (!r) {
            return { data: null, error: "No Retry-After header supplied on timeout" };
        }
        // The Retry-After header is in seconds
        const rr = parseFloat(r) * 1000;
        if (Number.isNaN(rr)) {
            return { data: null, error: "Invalid Retry-After header supplied" };
        }
        // Of course, negative values could also be supplied
        await sleep(Math.max(rr, 0));
        continue; // explicit, although useless
    }
}

interface AttachmentConfig {
    buf: Buffer;
    filename: string;
    content?: string;
}
type IndividualMessageFetchReturn = { data: Discord_MessageHandle; error: null } | { data: null; error: string };
async function sendMessageWithAttachment(channel: string, cfg: AttachmentConfig): Promise<IndividualMessageFetchReturn> {
    const form = new FormData();
    if (cfg.content) {
        form.append("content", cfg.content);
    }
    form.append("file", cfg.buf, { filename: cfg.filename });
    return fetchToDiscordApi<Discord_MessageHandle>({ target: `${API_BASE}/channels/${channel}/messages`, method: "POST", retryCount: 3, form });
}

function getNumberHeader(obj: Response, name: string, allowFloats?: boolean): number | null {
    const raw = obj.headers.get(name);
    if (!raw) {
        return null;
    }
    const val = allowFloats ? parseFloat(raw) : parseInt(raw);
    if (Number.isNaN(val)) {
        return null;
    }
    return val;
}

async function fetchMessages(channel: string, newestMsgId: string, requiredIds?: string[]): Promise<DataErrorFields<{ id: string; link: string }[]>> {
    // TODO: Also set the attachment cache in this function, as messages are filtered
    //       and thus some are not returned to the caller. (we can still cache them)
    const url = new URL(`${API_BASE}/channels/${channel}/messages`);
    url.searchParams.append("before", newestMsgId);
    url.searchParams.append("limit", MESSAGE_FETCH_LIMIT.toString());
    const response = await fetchToDiscordApi<Discord_MessageHandle[]>({ target: url, method: "GET", retryCount: 3 });
    if (!response.data) {
        return { data: null, error: response.error };
    }
    // When comparing the message list we just received to the
    // messages the caller provided to match, we of course need
    // not use the entire array of message ids provided to us.
    // The array is sorted with the newest messages being at then end,
    // we can just get a slice of that array corresponding to the
    // amount of messages we received from Discord. In the best case,
    // all of those Discord sent us belong to this file.

    // Important to remember that we fetched 100 messages BEFORE the newest one.
    // That means that the newest message, which sits at the end of the string array,
    // can never be within the response data.
    const index = requiredIds ? Math.max(requiredIds.length - response.data.length - 1, 0) : null;
    // Making a Set of this tends to improve performance
    const ids = requiredIds ? new Set(requiredIds.slice(index!)) : null;

    const links = new Array<{ id: string; link: string }>();
    for (const handle of response.data) {
        const link = extractAttachmentLinkFromMessage(handle);
        // As we now filter the messages, we would not want even those
        // that have no purpose for this file right now to just get lost.
        attachmentLinkCache.set(handle.id, link);
        if (ids && !ids.has(handle.id)) continue;
        links.push({ id: handle.id, link });
    }

    return { data: links, error: null };
}

function fetchIndividualMessage(channel: string, message: string): Promise<IndividualMessageFetchReturn> {
    return fetchToDiscordApi<Discord_MessageHandle>({ target: `${API_BASE}/channels/${channel}/messages/${message}`, method: "GET", retryCount: 3 });
}

/**
 * Check the docs: https://discord.com/developers/docs/reference#signed-attachment-cdn-urls
 */
function hasAttachmentExpired(link: string) {
    // We will not catch this constructor. If an invalid link got in here, we'd best know
    const url = new URL(link);
    // A seconds value encoded in hex
    const expireString = url.searchParams.get("ex");
    if (!expireString) return true;
    const timestamp = parseInt(expireString, 16);
    return isNaN(timestamp) || timestamp < Math.floor(Date.now() / 1000) + ATTACHMENT_EXPIRE_PADDING;
}

function sortMessages(messages: string[]) {
    return messages.sort((a, b) => {
        if (a.length !== b.length) {
            // If a has a greater snowflake, it should be shifted towards the end
            return a.length - b.length;
        }

        // Only the first 42 bits of the snowflake's 64 bit buffer are used for
        // the timestamp. For our purposes, we will assume that these messages
        // are not sent on the same millisecond. And even if so - and something
        // should happen to be sorted incorrectly - this function only attempts
        // to optimize the fetching process.
        return a.localeCompare(b);
    });
}

function extractAttachmentLinkFromMessage(msg: Discord_MessageHandle) {
    if (!msg.attachments.length) {
        // This should not happen as only messages that we know we sent are processed here
        throw new ReferenceError("No attachments attached to message: " + msg.id + " at " + msg.channel_id);
    }
    return msg.attachments[0].url;
}

type FetchRemoteBufferReturn = { buffer: ArrayBuffer; error: null } | { buffer: null; error: string };
async function fetchRemoteBuffer(target: string, maxAttempts = 3): Promise<FetchRemoteBufferReturn> {
    let attempts = 0;

    while (true) {
        attempts++;
        // If maxAttempts is 0, == would skip over, causing an infinite loop!!
        if (attempts >= maxAttempts) {
            logDebug(`Fail [${target}]: Maximum retries exceeded`);
            return { buffer: null, error: "Maximum retries exceeded" };
        }
        let response: Response;
        try {
            response = await fetch(target, { method: "GET" });
        } catch (error) {
            logDebug(`Fail [${target}]:`, error);
            return { buffer: null, error: "Failed to fetch" /* maybe some network error... */ };
        }

        if (response.ok) {
            return { buffer: await response.arrayBuffer(), error: null };
        }
        if (response.status === 429) {
            // The discord media cdn does not provide the API headers (x-ratelimit-...)
            // However, if this header is present, we know we can simply sleep
            const r = response.headers.get("Retry-After");
            if (!r) {
                return { buffer: null, error: "No Retry-After header supplied on timeout" };
            }
            // The Retry-After header is in seconds
            const rr = parseFloat(r) * 1000;
            if (Number.isNaN(rr)) {
                return { buffer: null, error: "Invalid Retry-After header supplied" };
            }
            // Of course, negative values could also be supplied
            await sleep(Math.max(rr, 0));
            continue;
        }

        const msgHandler = response.headers.get("Content-Type") === "application/json" ? response.json : response.text;
        try {
            const msg = await msgHandler();
            logDebug(`Fail [${target}]:`, response.status, msg);
        } catch {
            logDebug(`Fail [${target}]:`, response.status);
        }
        return { buffer: null, error: "Remote buffer fetching failed due to " + response.status };
    }
}

/**
 * https://discord.com/developers/docs/resources/message#message-object-message-structure
 */
interface Discord_MessageHandle {
    id: string;
    channel_id: string;
    attachments: Discord_AttachmentHandle[];
}

/**
 * https://discord.com/developers/docs/resources/message#attachment-object-attachment-structure
 */
interface Discord_AttachmentHandle {
    id: string;
    url: string;
    filename: string;
}
