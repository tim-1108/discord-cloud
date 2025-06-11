import { patterns } from "../common/patterns.js";
import FormData from "form-data";
import type { Message } from "../common/discord.js";
import { getEnvironmentVariables } from "../common/environment.js";
import axios, { AxiosError } from "axios";
import { sleep } from "../common/useless.js";
import { logError } from "../common/logging.js";

export async function sendWebhookMessage(attachment: Buffer, index: number, message: string, attemptCounter: number = 0) {
    const url = getWebhookURL();
    // FIXME: Will this bypass any cloudflare 429's?
    //        Even on the unnauthenticated webhook endpoint?
    const { BOT_TOKEN } = getEnvironmentVariables("upload-service");
    if (!url) {
        return null;
    }
    const form = new FormData();
    form.append("content", message);
    form.append("file", attachment, { filename: index.toString() });
    try {
        // Axios might be better, this still needs to be tested
        const response = await axios.post(url, form.getBuffer(), {
            headers: { ...form.getHeaders(), Authorization: `Bot ${BOT_TOKEN}` },
            validateStatus(status) {
                // Anything but 200 is something we do not expect
                return status === 200;
            }
        });
        const data = response.data as Partial<Message>;
        // Acts as a fallback
        if (response.status !== 200) {
            logError("Failed to send message", response.status, response.data);
            return null;
        }
        return typeof data.id === "string" && typeof data.channel_id === "string" ? { id: data.id, channel_id: data.channel_id } : null;
    } catch (error) {
        if (!(error instanceof AxiosError)) return null;
        logError("Axios Error:", error, error.response);
        if (error.status === 429 && attemptCounter < 5) {
            const retryAfterSeconds = parseFloat(error.response?.data?.retry_after) || 1;
            await sleep(retryAfterSeconds * 1000);
            attemptCounter++;
            return sendWebhookMessage(attachment, index, message, attemptCounter);
        }
        return null;
    }
}
function getWebhookURL() {
    const env = getEnvironmentVariables("upload-service").WEBHOOK_URL;
    if (!patterns.webhookUrl.test(env)) {
        console.warn("Invalid webhook URL", env);
        return null;
    }
    return env;
}
