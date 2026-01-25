import { generateErrorResponse, generateResponse } from "../utils/http.js";
import type { Request, Response } from "express";
import { getSearchParamsForAddress } from "../utils/url.js";
import { patterns } from "../../common/patterns.js";
import { validateObjectBySchema } from "../../common/validator.js";
import { Database } from "../database/index.js";
import { Authentication } from "../authentication.js";

const schema = {
    username: { type: "string", required: true, pattern: patterns.username },
    password: { type: "string", required: true, min_length: 8, max_length: 256 }
} as const;
export default async function handleRequest(req: Request, res: Response): Promise<void> {
    const params = getSearchParamsForAddress(req.url, "username", "password");
    const validation = validateObjectBySchema(params, schema);
    if (validation.invalid || validation.offenses.length) {
        return void generateErrorResponse(res, 400, validation);
    }

    const { username, password } = validation.value;
    const handle = await Database.user.getByName(username);
    if (handle === null) {
        return void generateErrorResponse(res, 403);
    }

    const isValid = Authentication.password.verify(handle.password, password, handle.salt);
    if (!isValid) {
        return void generateErrorResponse(res, 403);
    }

    // TODO: pass the handle itself, not just the id
    const token = await Authentication.generateUserToken(handle.id);
    if (token === null) {
        generateErrorResponse(res, 500, "Failed to generate user token");
        return;
    }
    generateResponse(res, 200, { token });
}
