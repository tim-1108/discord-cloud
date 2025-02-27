import type { Request, Response } from "express";
import httpStatusCodes from "../http-status-codes.js";

export function generateErrorResponse(res: Response, status: number = 400, errorDetails?: any, additionalData: Record<string, any> = {}) {
    return generateResponse(res, status, additionalData, errorDetails);
}

export function generateResponse(res: Response, status: number = 200, data: Record<string, any> = {}, errorDetails?: any) {
    const shouldHaveError = status !== 200;
    const details = shouldHaveError ? (errorDetails ?? httpStatusCodes[status] ?? undefined) : undefined;
    return res.status(status).json({ shouldHaveError, error_details: details, ...data });
}

export function getRequestUrl(req: Request) {
    try {
        return new URL(`http://localhost${req.url}`);
    } catch {
        return null;
    }
}

export function getQuery(req: Request) {
    const url = getRequestUrl(req);
    return url?.searchParams ?? null;
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

export function isCrawlerRequest(req: Request) {
    const userAgent = req.headers["user-agent"];
    if (!userAgent) return false;
    return CRAWLER_AGENTS.some((crawler) => userAgent.toLowerCase().includes(crawler));
}
