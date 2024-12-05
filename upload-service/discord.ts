import { patterns } from "../common/patterns.ts";
import FormData from "form-data";
import type { Message } from "../common/discord";

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
    const env = process.env.WEBHOOK_URL;
    if (!env || patterns.webhookUrl.test(env)) {
        console.warn("Invalid webhook URL", env);
        return null;
    }
    return env;
}
