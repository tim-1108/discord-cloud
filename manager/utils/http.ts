import type { Request, Response } from "express";
import { patterns } from "../../common/patterns.js";

const httpStatusCodes = {
    400: "Bad Request",
    401: "Unauthorized",
    500: "Internal Server Error",
    503: "Service Not Available"
} as Record<number, string>;

export function generateErrorResponse(res: Response, status: number = 400, errorDetails?: any, additionalData: Record<string, any> = {}) {
    return generateResponse(res, status, additionalData, errorDetails);
}

export function generateResponse(res: Response, status: number = 200, data: Record<string, any> = {}, errorDetails?: any) {
    const shouldHaveError = status !== 200;
    const details = shouldHaveError ? (errorDetails ?? httpStatusCodes[status] ?? undefined) : undefined;
    const content = { error: shouldHaveError, error_details: details, ...data };
    if (isHeadRequest(res.req)) {
        return res.setHeader("Content-Length", JSON.stringify(content).length).sendStatus(status);
    }
    return res.status(status).json(content);
}

export function getRequestUrl(req: Request) {
    try {
        return new URL(`http://localhost${req.url}`);
    } catch {
        return null;
    }
}

export function getRequestQuery(req: Request): URLSearchParams | null {
    const url = getRequestUrl(req);
    return url?.searchParams ?? null;
}

export function getRequestAuthorization(req: Request): string | null {
    const url = getRequestUrl(req);
    if (url === null) {
        return req.headers.authorization ?? null;
    }

    return req.headers.authorization ?? url.searchParams.get("auth");
}

export type RequestRange = { from: number; to: number };

/**
 * The HTTP spec supports passing multiple ranges. If so, they are returned using
 * the "multipart/byteranges" header. Only the "bytes" type is supported.
 *
 * `size` specifies the total size of the content. Limits the ranges to that size.
 */
export function getRequestRanges(req: Request, size: number) {
    const r = req.headers.range;
    if (!r || !patterns.rangeHeader.test(r)) {
        return null;
    }
    const ranges = r
        .replace(/^bytes=/, "")
        .split(", ")
        .map((part) => parseRangePart(part, size))
        .filter((val) => val !== null);
    if (!ranges.length) {
        return null;
    }
    // One needs to be added as the to property is non-exclusive
    const total = ranges.reduce((total, { from, to }) => total + (to - from) + 1, 0);
    return { total, ranges };
}

/**
 * We expect only data that passed the `patterns.rangeHeader` check
 * to be passed to this function.
 */
function parseRangePart(part: string, size: number): RequestRange | null {
    // As the byte ranges start at 0, the last byte is
    // also the total content size minus 1.
    const lastByte = size - 1;
    const [from, to] = part
        .split("-")
        .map((val) => parseInt(val, 10))
        .map((val) => (val < 0 || val > lastByte ? NaN : val));
    const fn = Number.isNaN(from);
    const tn = Number.isNaN(to);
    // Cannot download a range with a length of 0
    if (from >= to) {
        return null;
    }
    // This indicates that the Range header only has the <suffix-length>,
    // which means that the server should respond with the amount of bytes
    // specified there substracted from the end.
    if (fn && !tn) {
        return { from: size - to, to: lastByte };
    }
    if (!fn && tn) {
        return { from, to: lastByte };
    }
    // Now neither of the two special cases have hit and thus the two inputted
    // values must actually be valid for any range to be returned.
    if (fn || tn) {
        return null;
    }
    return { from, to };
}

const CRAWLER_AGENTS = [
    "Discordbot", // Discord
    "Twitterbot", // Twitter
    "WhatsApp", // WhatsApp
    "TelegramBot", // Telegram
    "Slackbot", // Slack
    "facebookexternalhit", // Facebook
    "LinkedInBot" // LinkedIn
].map((crawler) => crawler.toLowerCase());

export function isCrawlerRequest(req: Request): boolean {
    const userAgent = req.headers["user-agent"];
    if (!userAgent) return false;
    return CRAWLER_AGENTS.some((crawler) => userAgent.toLowerCase().includes(crawler));
}

export function isHeadRequest(req: Request) {
    return req.method === "HEAD";
}
