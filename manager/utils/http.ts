import type { Request, Response } from "express";

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
    return res.status(status).json({ error: shouldHaveError, error_details: details, ...data });
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
