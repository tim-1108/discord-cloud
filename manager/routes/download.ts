import type { Request, Response } from "express";
import { generateErrorResponse, getRequestQuery, getRequestUrl, isCrawlerRequest } from "../utils/http.js";
import { patterns } from "../../common/patterns.js";
import { escapeQuotes, parseFileSize } from "../../common/useless.js";
import { streamFileToResponse_wrapper } from "../utils/stream-download.js";
import { Database } from "../database/index.js";
import { Authentication } from "../authentication.js";

export default async function handleRequest(req: Request, res: Response): Promise<void> {
    const query = getRequestQuery(req);
    if (!query) {
        return void generateErrorResponse(res, 400, "Bad request query");
    }

    const path = query.get("path");
    const name = query.get("name");
    const authorization = query.get("auth");

    // TODO: implement a proper request validation system á la validator.ts
    if (!path || !name || !patterns.stringifiedPath.test(path) || !patterns.fileName.test(name)) {
        return void generateErrorResponse(res, 400, "Please provide path and name fields in query");
    }

    if (authorization === null) {
        return void generateErrorResponse(res, 400, "No token provided");
    }
    const user = await Authentication.verifyUserToken(authorization);
    if (user === null) {
        return void generateErrorResponse(res, 401, "Unauthorized");
    }

    const handle = await Database.file.getWithPath(name, path);
    if (handle == null) {
        return void generateErrorResponse(res, 404, "File not found");
    }

    if (isCrawlerRequest(req)) {
        res.setHeader("Content-Type", "text/html");
        res.send(`
            <html>
                <head>
                    <meta property="og:title" content="${escapeQuotes(handle.name)}" />
                    <meta property="og:type" content="website" />
                    <meta property="og:url" content="${getRequestUrl(req)?.toString()}" />
                    <meta property="og:description" content="File &quot;${escapeQuotes(handle.name)}&quot; at ${escapeQuotes(path)} (${parseFileSize(handle.size)})"
                </head>
                <body></body>
            </html>
        `);
        return;
    }

    const ownership = await Authentication.permissions.ownership(user, handle.id);
    if (!ownership || ownership.status === "restricted") {
        return void generateErrorResponse(res, 403, "Forbidden");
    }

    void streamFileToResponse_wrapper(req, res, handle);
}
