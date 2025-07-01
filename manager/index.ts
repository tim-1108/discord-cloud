import { validateEnvironmentVariables } from "../common/environment.js";
import { loadPackets } from "../common/packet/reader.js";
import { Network } from "./Network.js";

validateEnvironmentVariables("common", "manager", "discord", "crypto");
await loadPackets();

new Network(4000);
