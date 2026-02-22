import { generateErrorResponse, generateResponse } from "../utils/http.js";
import type { Request, Response } from "express";
import { getSearchParamsForAddress } from "../utils/url.js";
import { validateObjectBySchema } from "../../common/validator.js";
import { Database } from "../database/index.js";
import { getEnvironmentVariables } from "../../common/environment.js";
import { Authentication } from "../authentication.js";
import { ClientList } from "../client/list.js";

const schema = {
    username: { type: "string", required: true, min_length: 1 },
    previousPassword: { type: "string", required: true, min_length: 8, max_length: 256 },
    newPassword: { type: "string", required: true, min_length: 8, max_length: 256 }
} as const;
export default async function handleRequest(req: Request, res: Response): Promise<void> {
    const env = getEnvironmentVariables("manager");
    const params = getSearchParamsForAddress(req.url, "username", "previousPassword", "newPassword");
    const validation = validateObjectBySchema(params, schema);
    if (validation.invalid) {
        return void generateErrorResponse(res, 400, validation);
    }

    const { username, previousPassword, newPassword } = validation.value;
    if (previousPassword === newPassword) {
        return void generateErrorResponse(res, 400, "The passwords must not be identical");
    }

    const userHandle = await Database.user.getByName(username);
    if (userHandle === null) {
        return void generateErrorResponse(res, 404, "No user exists for this user id");
    }

    const isOldPasswordValid = Authentication.password.verify(userHandle.password, previousPassword, userHandle.salt);
    if (!isOldPasswordValid) {
        return void generateErrorResponse(res, 401, "The supplied previous password is invalid");
    }

    const { hash, salt } = Authentication.password.generate(newPassword);
    const newHandle = await Database.user.updatePassword({ id: userHandle.id, password: hash, salt });
    if (!newHandle) {
        return void generateErrorResponse(res, 500, "Failed to update the user handle");
    }

    // All old tokens will have been invalidated as they contain the password hash
    ClientList.disconnect((id) => newHandle.id === id);

    generateResponse(res, 200, newHandle);
}
