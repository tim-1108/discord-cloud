import { getEnvironmentVariables, validateEnvironmentVariables } from "../common/environment.js";
import { logInfo } from "../common/logging.js";
import { loadPackets } from "../common/packet/reader.js";
import { Database } from "./database/index.js";
import { Network } from "./Network.js";
import "./debug.js";
import "./services/list.js";
import { startWebDAVServer } from "./webdav/dav-server.js";
import { SymmetricCrypto } from "../common/symmetric-crypto.js";
import { Discord } from "../common/discord_new.js";
import config from "../manager.config.js";

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

if (config.webdav.enabled) {
    startWebDAVServer();
}

logInfo("Init: Network on port", config.socket.port);
new Network(config.socket.port);
