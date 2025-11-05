import { getEnvironmentVariables, validateEnvironmentVariables } from "../common/environment.js";
import { loadPackets } from "../common/packet/reader.js";
import { Network } from "./Network.js";
import { pingServices } from "./pinging.js";

validateEnvironmentVariables("common", "manager", "discord", "crypto");
await loadPackets();

const pinging = getEnvironmentVariables("service-pinger", true);
if (pinging.SERVICE_PINGING_ENABLED === "1") {
    setInterval(pingServices, 60_000);
}

new Network(4000);
