import { generateErrorResponse, generateResponse } from "../utils/http.js";
import type { Request, Response } from "express";
import { getSearchParamsForAddress } from "../utils/url.js";
import { patterns } from "../../common/patterns.js";
import { validateObjectBySchema } from "../../common/validator.js";
import { Authentication } from "../authentication.js";

const schema = {
    token: { type: "string", required: true, pattern: patterns.jwt }
} as const;
export default async function handleRequest(req: Request, res: Response): Promise<void> {
    const params = getSearchParamsForAddress(req.url, "token");
    const validation = validateObjectBySchema(params, schema);
    if (validation.invalid) {
        return void generateErrorResponse(res, 400, validation);
    }

    const { token } = validation.value;
    const userId = await Authentication.verifyUserToken(token);
    const flag = userId !== null;

    generateResponse(res, flag ? 200 : 401, { error: !flag, user_id: userId });
}
