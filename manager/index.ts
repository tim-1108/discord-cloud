import { getEnvironmentVariables, validateEnvironmentVariables } from "../common/environment.js";
import { logInfo } from "../common/logging.js";
import { loadPackets } from "../common/packet/reader.js";
import { Database } from "./database/index.js";
import { Network } from "./Network.js";
import "./debug.js";
import "./services/list.js";
import { SymmetricCrypto } from "../common/symmetric-crypto.js";
import { Discord } from "../common/discord_new.js";
import config from "../manager.config.js";

validateEnvironmentVariables("manager");
await loadPackets();

const env = getEnvironmentVariables("manager");
const { MESSAGE_ENCRYPTION_KEY } = getEnvironmentVariables("crypto", true);
Discord.initialize(env.DISCORD_BOT_TOKEN);
if (MESSAGE_ENCRYPTION_KEY) {
    SymmetricCrypto.initialize(MESSAGE_ENCRYPTION_KEY);
} else if (config.discord.useEncryption) {
    throw new ReferenceError("Discord encryption is enabled, but no key is set");
}

logInfo("Init: Folder tree");
const folders = await Database.getAll("folders");
const sizes = await Database.getAll("get_folder_sizes_by_file_type");
if (!folders.data || !sizes.data) {
    throw new ReferenceError("Failed to compute folder tree");
}
Database.tree.init(folders.data, sizes.data);
logInfo("Init: Folder tree done");

const { MANAGER_PORT } = getEnvironmentVariables("manager");
const port = parseInt(MANAGER_PORT, 10);
if (!Number.isSafeInteger(port) || port <= 0 || port > 32767) {
    throw new Error("The port value is invalid: " + port);
}
logInfo("Init: Network on port", port);
new Network(port);
