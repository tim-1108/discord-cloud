import type { Request, Response } from "express";
import { generateErrorResponse, getRequestQuery } from "../utils/http.js";
import { patterns } from "../../common/patterns.js";
import { getEnvironmentVariables } from "../../common/environment.js";
import { generateSignedFileDownload } from "../database/public.js";

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

    const object = await generateSignedFileDownload(name, path);
    if (!object) {
        return void generateErrorResponse(res, 500, "Failed to create signed link - does the file exist?");
    }

    res.send(object);
}
