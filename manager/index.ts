import { getEnvironmentVariables, validateEnvironmentVariables } from "../common/environment.js";
import { logError, logInfo } from "../common/logging.js";
import { loadPackets } from "../common/packet/reader.js";
import { Database } from "./database/index.js";
import { Network } from "./Network.js";
import { pingServices } from "./pinging.js";

validateEnvironmentVariables("common", "manager", "discord", "crypto");
await loadPackets();

const pinging = getEnvironmentVariables("service-pinger", true);
if (pinging.SERVICE_PINGING_ENABLED === "1") {
    setInterval(pingServices, 60_000);
}

logInfo("Init: Folder tree");
const folders = await Database.folder.getAll();
const sizes = await Database.sizes.fileTypeByFolder();
if (!folders || !sizes) {
    process.exit(1);
}
Database.tree.init(folders, sizes);
logInfo("Init: Folder tree done");

new Network(4000);
