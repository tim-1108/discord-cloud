import { logDebug, logWarn } from "../common/logging.js";
import managerConfig from "../manager.config.js";
import { cleanURL } from "./utils/url.js";

let lastPingTimestamp = 0;
const DELTA_PING_MS = 60_000 as const;

/**
 * Pings all services registered inside SERVICES environment variable.
 *
 * Only possible every {@link DELTA_PING_MS} ms.
 */
export function pingServices() {
    if (!managerConfig.pinging.enabled || managerConfig.pinging.services.length === 0) return;

    const now = Date.now();
    if (lastPingTimestamp + DELTA_PING_MS > now) return;
    lastPingTimestamp = now;

    for (const service of managerConfig.pinging.services) {
        const url = cleanURL(service);
        if (!url) {
            logWarn("Malformed url for ping:", url);
            continue;
        }
        url.pathname = `/${Math.random()}`;
        void fetch(url).catch((error) => {
            logDebug(`Failed to send ping to ${url} due to`, error);
        });
    }
}
