import { logError } from "../../common/logging.js";
import type { UserSearchRequestPacket } from "../../common/packet/c2s/UserSearchRequestPacket.js";
import { UserSearchPacket } from "../../common/packet/s2c/UserSearchPacket.js";
import type { Client } from "../client/Client.js";
import { Database } from "../database/index.js";

export const UserClientOperations = {
    userSearch
} as const;

async function userSearch(client: Client, packet: UserSearchRequestPacket): Promise<void> {
    const { query } = packet.getData();
    // We can be sure that this query meets the username pattern.
    const response = await Database.users.findByName(query);
    if (response.error !== null) {
        logError("Failed to search for users:", response.error);
    }
    const results = response.data ? response.data.map(({ id, username }) => ({ id: id, name: username })) : undefined;
    client.replyToPacket(packet, new UserSearchPacket({ success: response.error === null, results }));
}
