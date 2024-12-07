import { getEnvironmentVariables } from "../common/environment";
import { cleanURL } from "./utils/url";

let lastPingTimestamp = 0;
const DELTA_PING_MS = 60_000 as const;

/**
 * Pings all services registered inside SERVICES environment variable.
 *
 * Only possible every {@link DELTA_PING_MS} ms.
 */
export function pingServices() {
    const { SERVICES, SERVICE_PINGING_ENABLED } = getEnvironmentVariables("service-pinger", true);
    if (SERVICE_PINGING_ENABLED !== "1" || typeof SERVICES !== "string") return;

    const now = Date.now();
    if (lastPingTimestamp + DELTA_PING_MS > now) return;
    lastPingTimestamp = now;

    const services = SERVICES.split(",");
    for (const service of services) {
        const url = cleanURL(service);
        if (!url) {
            console.warn(`[Ping] Cannot ping service ${service}`);
            continue;
        }
        void fetch(url).catch((error) => {
            console.warn(`[Ping] Failed to send ping to ${url} due to`, error);
        });
    }
}
