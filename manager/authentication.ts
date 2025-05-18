import jwt from "jsonwebtoken";
import { getEnvironmentVariables } from "../common/environment";

const env = getEnvironmentVariables("crypto");
const privateKey = Buffer.from(env.PRIVATE_KEY, "base64");
const publicKey = Buffer.from(env.PUBLIC_KEY, "base64");

function generateUserToken(user: number) {
    const token = jwt.sign({ user }, privateKey);
    console.log(token);
}

export const Authentication = {
    generateUserToken
} as const;
