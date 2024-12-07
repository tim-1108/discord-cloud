import { patterns } from "../common/patterns";
import FormData from "form-data";
import type { Message } from "../common/discord";
import { getEnvironmentVariables } from "../common/environment";

export async function sendWebhookMessage(attachment: Buffer, index: number, message: string) {
    const url = getWebhookURL();
    if (!url) {
        return null;
    }
    const form = new FormData();
    form.append("content", message);
    form.append("file", attachment, { filename: index.toString() });
    try {
        // Axios might be better, this still needs to be tested
        const response = await fetch(url, {
            method: "POST",
            body: form.getBuffer(),
            headers: form.getHeaders()
        });
        const data = (await response.json()) as Partial<Message>;
        if (!response.ok) {
            console.log("Have we been rate limited?", data);
            return null;
        }
        return typeof data.id === "string" ? data.id : null;
    } catch {
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
