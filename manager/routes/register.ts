import { generateErrorResponse, generateResponse } from "../utils/http.js";
import type { Request, Response } from "express";
import { getSearchParamsForAddress } from "../utils/url.js";
import { patterns } from "../../common/patterns.js";
import { validateObjectBySchema } from "../../common/validator.js";
import { Database } from "../database/index.js";
import { getEnvironmentVariables } from "../../common/environment.js";
import { Authentication } from "../authentication.js";

const schema = {
    username: { type: "string", required: true, pattern: patterns.username },
    password: { type: "string", required: true, min_length: 8, max_length: 256 },
    adminToken: { type: "string", required: false, pattern: patterns.jwt }
} as const;
export default async function handleRequest(req: Request, res: Response): Promise<void> {
    const env = getEnvironmentVariables("manager");
    const params = getSearchParamsForAddress(req.url, "username", "password", "adminToken");
    const validation = validateObjectBySchema(params, schema);
    if (validation.invalid) {
        return void generateErrorResponse(res, 400, validation);
    }

    const { username, password, adminToken } = validation.value;

    const userCount = await Database.user.getCount();
    if (userCount.error) {
        return void generateErrorResponse(res, 500, "Failed to compute user count");
    }

    const noAdminsExist = userCount.data === 0;
    if (!noAdminsExist) {
        if (!adminToken) {
            return void generateErrorResponse(res, 400, "No admin token supplied");
        }
        const userId = await Authentication.verifyUserToken(adminToken);
        if (userId === null) {
            return void generateErrorResponse(res, 403, "Invalid admin user token");
        }
        const userHandle = await Database.user.get(userId);
        if (!userHandle || !userHandle.administrator) {
            return void generateErrorResponse(res, 403, "You are no administrator");
        }
    }

    const existingUser = await Database.user.getByName(username);
    if (existingUser !== null) {
        generateErrorResponse(res, 400, "A user with this name already exists");
        return;
    }

    const handle = await Database.user.add(username, password, noAdminsExist);
    if (handle === null) {
        generateErrorResponse(res, 500, "Failed to create user handle");
        return;
    }

    generateResponse(res, 200, handle);
}
