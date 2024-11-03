import type { Response } from "express";
import httpStatusCodes from "../http-status-codes.ts";

export function generateResponse(res: Response, status: number = 200, data: Record<string, any> = {}, errorDetails?: any) {
    const shouldHaveError = status !== 200;
    const details = shouldHaveError ? (errorDetails ?? httpStatusCodes[status] ?? undefined) : undefined;
    return res.status(status).json({ shouldHaveError, error_details: details, ...data });
}
