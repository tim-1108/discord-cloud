import type { Request, Response } from "express";
import { generateErrorResponse, getRequestQuery } from "../utils/http.js";
import { patterns } from "../../common/patterns.js";
import { generateSignedFileDownload } from "../database/public.js";
import { Authentication } from "../authentication.js";
import { Database } from "../database/index.js";

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

    const ownership = await Authentication.permissions.ownership(user, handle.id);
    // Only the user who owns the file may actually create links for it
    if (!ownership || ownership.status !== "owned") {
        return void generateErrorResponse(res, 403, "Forbidden");
    }

    const object = await generateSignedFileDownload(handle, path);
    if (!object) {
        return void generateErrorResponse(res, 500, "Failed to create signed link - does the file exist?");
    }

    res.send(object);
}
