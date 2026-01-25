import { generateErrorResponse, generateResponse } from "../utils/http.js";
import type { Request, Response } from "express";
import { getSearchParamsForAddress } from "../utils/url.js";
import { patterns } from "../../common/patterns.js";
import { validateObjectBySchema } from "../../common/validator.js";
import { Database } from "../database/index.js";
import { getEnvironmentVariables } from "../../common/environment.js";

const schema = {
    username: { type: "string", required: true, pattern: patterns.username },
    password: { type: "string", required: true, min_length: 8, max_length: 256 },
    key: { type: "string", required: true }
} as const;
export default async function handleRequest(req: Request, res: Response): Promise<void> {
    const env = getEnvironmentVariables("manager");
    const params = getSearchParamsForAddress(req.url, "username", "password", "key");
    const validation = validateObjectBySchema(params, schema);
    if (validation.invalid || validation.offenses.length) {
        return void generateErrorResponse(res, 400, validation);
    }

    if (validation.value.key !== env.SERVICE_PASSWORD) {
        generateErrorResponse(res, 403);
        return;
    }

    const existingUser = await Database.user.getByName(validation.value.username);
    if (existingUser !== null) {
        generateErrorResponse(res, 400, "A user with this name already exists");
        return;
    }

    const handle = await Database.user.add(validation.value.username, validation.value.password);
    if (handle === null) {
        generateErrorResponse(res, 500, "Failed to create user handle");
        return;
    }

    generateResponse(res, 200, handle);
}
