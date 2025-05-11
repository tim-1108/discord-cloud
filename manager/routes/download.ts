import type { Request, Response } from "express";
import { generateErrorResponse, getRequestQuery, getRequestUrl, isCrawlerRequest } from "../utils/http.js";
import { patterns } from "../../common/patterns.js";
import { getEnvironmentVariables } from "../../common/environment.js";
import { getFileFromDatabase } from "../database/finding.js";
import { escapeQuotes, parseFileSize } from "../../common/useless.js";
import { streamDownloadToResponse } from "../utils/stream-download.js";

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

    const fileData = await getFileFromDatabase(name, path);
    if (fileData == null) {
        return void generateErrorResponse(res, 404, "File not found");
    }

    if (isCrawlerRequest(req)) {
            res.setHeader("Content-Type", "text/html");
            res.send(`
            <html>
                <head>
                    <meta property="og:title" content="${escapeQuotes(fileData.name)}" />
                    <meta property="og:type" content="website" />
                    <meta property="og:url" content="${getRequestUrl(req)?.toString()}" />
                    <meta property="og:description" content="File &quot;${escapeQuotes(fileData.name)}&quot; at ${escapeQuotes(path)} (${parseFileSize(fileData.size)})"
                </head>
                <body></body>
            </html>
        `);
            return;
        }

    return streamDownloadToResponse(req, res, fileData);
}
