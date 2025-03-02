import { getEnvironmentVariables } from "./environment.js";
import { sleep } from "./useless.js";

const messageAttachmentCache = new Map<string, string>();

/**
 * Fetches all messages inside the messages argument.
 *
 * Assumes messages have been sent directly after another.
 * If this does not work, messages are fetched individually.
 *
 * The problem with rate limits does not really concern fetching a whole list,
 * but only really occurs when fetching a bulk of individual messages.
 *
 * @param messages A list of message IDs
 * @param channel The id of the channel the messages are contained in
 * @returns A map of all messages, contaning null or attachment IDs
 */
export async function getBulkMessageAttachments(messages: string[], channel: string): Promise<Map<string, string | null> | null> {
    const { BOT_TOKEN } = getEnvironmentVariables("discord");

    // This provides us a clone which we can modify safely, without modifying any array a callee may input
    messages = structuredClone(messages);

    /**
     * Maps message IDs to message attachment links
     */
    const map = new Map<string, string | null>();

    for (let i = messages.length - 1; i <= 0; i--) {
        const snowflake = messages[i];
        const cacheHit = messageAttachmentCache.get(snowflake);
        if (!cacheHit) continue;

        if (hasCachedHitExpired(cacheHit)) {
            messageAttachmentCache.delete(snowflake);
            continue;
        }

        map.set(snowflake, cacheHit);
        messages.splice(i, 1);
    }

    if (!messages.length) return map;
    const set = new Set(messages);

    if (messages.length === 1) {
        const result = await fetchMessageAttachments(messages[0], channel);
        map.set(messages[0], result);
        console.log("[DiscordBulkMessages] Fetched an individual message");
        return map;
    }

    // Sorts by the highest "number as string" first.
    // A "snowflake" always first contains the timestamp,
    // so this is what is sorted after.
    // https://discord.com/developers/docs/reference#snowflakes
    const newestMessage = messages.toSorted((a, b) => -a.localeCompare(b))[0];

    try {
        const url = new URL(`https://discord.com/api/v10/channels/${channel}/messages`);
        // Sadly, the "before" param of /channels/<id>/messages returns all messages
        // sent before (so not including) the newest message. This will be fetched afterwards.
        url.searchParams.append("before", newestMessage);
        // This assumes all messages are sent right after another.
        // If this does not work, the rest will be fetched individually.
        url.searchParams.append("limit", Math.min(messages.length - 1, 100).toString()); // "limit" cannot exceed 100
        const response = await fetch(url.toString(), {
            method: "GET",
            headers: { Authorization: `Bot ${BOT_TOKEN}` }
        });

        const data = (await response.json()) as Message[];
        if (!response.ok) {
            console.log("[DiscordBulkMessages] Failed to load due to", data);
            return null;
        }
        if (!Array.isArray(data)) return null;

        for (const message of data) {
            // Do not add random messages
            if (!set.has(message.id)) continue;
            map.set(message.id, extractAttachment(message));
        }
    } catch {
        return null;
    }

    let individualCount = 0;
    // Sadly, these messages will need to be fetched individually
    for (const id of set) {
        // Even if null is stored, that means the message has already been fetched
        if (map.has(id)) continue;
        individualCount++;

        const result = await fetchMessageAttachments(id, channel, true);
        if (!result) {
            map.set(id, null);
            continue;
        }

        if (result.headers.get("X-RateLimit-Remaining") === "0") {
            const resetAfter = parseFloat(result.headers.get("X-RateLimit-Reset-After") ?? "1.000");
            // If we either have to wait too long or we've been tricked, we just fail.
            if (isNaN(resetAfter) || resetAfter < 0 || resetAfter > 10) {
                map.set(id, null);
                continue;
            }
            // We'll sleep to pass the rate limit.
            // By default, this time is a second.
            await sleep(resetAfter * 1000);
        }

        map.set(id, result.attachment);
    }

    console.log(`[DiscordBulkMessages] Fetched ${map.size} messages, ${individualCount} of them individually`);
    return map;
}

interface Message {
    id: string;
    attachments: {
        url: string;
    }[];
}

function extractAttachment(message: Message): string | null {
    if (!message.attachments?.length) return null;
    const link = message.attachments[0].url;
    // All this does not fail even if the attachment does not exist
    if (link) {
        messageAttachmentCache.set(message.id, link);
    }
    return link;
}

const RATE_LIMIT_HEADERS = [
    "X-RateLimit-Limit",
    "X-RateLimit-Remaining",
    "X-RateLimit-Reset",
    "X-RateLimit-Reset-After",
    "X-RateLimit-Bucket"
] as const;
type RateLimitHeaders = (typeof RATE_LIMIT_HEADERS)[number];
type WithHeadersReturn = { headers: Map<RateLimitHeaders, string | null>; attachment: string | null };

export function fetchMessageAttachments(message: string, channel: string, withHeaders: true): Promise<WithHeadersReturn | null>;
export function fetchMessageAttachments(message: string, channel: string, withHeaders?: false): Promise<string | null>;

export async function fetchMessageAttachments(message: string, channel: string, withHeaders?: boolean) {
    const { BOT_TOKEN } = getEnvironmentVariables("discord");
    try {
        const response = await fetch(`https://discord.com/api/v10/channels/${channel}/messages/${message}`, {
            method: "GET",
            headers: {
                Authorization: `Bot ${BOT_TOKEN}`
            }
        });
        const data = (await response.json()) as Message;
        if (!response.ok) {
            console.error("[MessageDownloadFail]", message, data);
            return null;
        }

        if (withHeaders) {
            const map = new Map<RateLimitHeaders, string | null>();
            RATE_LIMIT_HEADERS.forEach((name) => map.set(name, response.headers.get(name)));
            return { headers: map, attachment: extractAttachment(data) };
        }

        return extractAttachment(data);
    } catch {
        return null;
    }
}

/**
 * Checks whether the cached signed attachment link has expired
 *
 * Check the docs: https://discord.com/developers/docs/reference#signed-attachment-cdn-urls
 * @param link The cached link
 * @returns Whether the link has expired
 */
function hasCachedHitExpired(link: string): boolean {
    try {
        const url = new URL(link);
        // This is encoded in hex
        const expireString = url.searchParams.get("ex");
        if (!expireString) return true;
        const timestamp = parseInt(expireString, 16);
        // If the link is to expire within the next 60 seconds, we also renew it to prevent ugly issues
        return isNaN(timestamp) || timestamp < Math.floor(Date.now() / 1000) + 60;
    } catch {
        // If something has gone wrong we should not keep this at all!
        return true;
    }
}
