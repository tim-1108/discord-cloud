import type { Request, Response } from "express";
import { generateErrorResponse, getRequestQuery, getRequestUrl, isCrawlerRequest } from "../utils/http.js";
import { patterns } from "../../common/patterns.js";
import { getEnvironmentVariables } from "../../common/environment.js";
import { escapeQuotes, parseFileSize } from "../../common/useless.js";
import { streamFileContents } from "../utils/stream-download.js";
import { logError } from "../../common/logging.js";
import { Database } from "../database/index.js";

export default async function handleRequest(req: Request, res: Response): Promise<void> {
    const env = getEnvironmentVariables("manager");
    const query = getRequestQuery(req);
    if (!query) {
        return void generateErrorResponse(res, 400, "Bad request query");
    }

    const path = query.get("path");
    const name = query.get("name");
    const authorization = query.get("auth");

    // TODO: implement a permissions system. Not everyone who's allowed to connect to the service should be able to create shareable links
    if (authorization !== env.CLIENT_PASSWORD) {
        return void generateErrorResponse(res, 401, "Unauthorized");
    }

    // TODO: implement a proper request validation system á la validator.ts
    if (!path || !name || !patterns.stringifiedPath.test(path) || !patterns.fileName.test(name)) {
        return void generateErrorResponse(res, 400, "Please provide path and name fields in query");
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

    res.setHeader("Content-Disposition", `attachment; filename="${handle.name}"`);
    res.setHeader("Content-Length", handle.size);
    // I am responsible for causing the headers to be sent to the client before
    // any response body is sent. Without the headers sent, the request might time out.
    res.write("");

    const result = await streamFileContents(res, handle);
    if (result !== null) {
        logError("Download route error:", result);
    }
}
