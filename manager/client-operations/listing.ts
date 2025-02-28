import type { ListRequestPacket } from "../../common/packet/c2s/ListRequestPacket.js";
import { type PartialDatabaseFileRow, type PartialDatabaseFolderRow, resolvePathToFolderId_Cached } from "../database/core.js";
import type { Client } from "../Client.js";
import { ListPacket } from "../../common/packet/s2c/ListPacket.js";
import { listFilesAtDirectory, listSubfolders } from "../database/finding.js";

/**
 * Performs a query on the database for all folders and files listed
 * for the folder inside the packet given to the function.
 *
 * Even if the lookup fails, a packet with empty subfolders
 * and files is sent.
 *
 * The reply packet is of type {@link ListPacket}
 * @param client The client who should be replied to
 * @param packet The packet the client sent
 */
export async function performListPacketOperation(client: Client, packet: ListRequestPacket): Promise<void> {
    const { path } = packet.getData();
    const folderId = await resolvePathToFolderId_Cached(path, false);
    if (!folderId) return sendReplyPacket(client, packet, [], []);

    const folders = await listSubfolders(folderId);
    const files = await listFilesAtDirectory(folderId);

    if (!files || !folders) {
        return sendReplyPacket(client, packet, [], []);
    }

    sendReplyPacket(client, packet, folders, files);
}

function sendReplyPacket(client: Client, originator: ListRequestPacket, folders: PartialDatabaseFolderRow[], files: PartialDatabaseFileRow[]) {
    const { path } = originator.getData();
    const reply = new ListPacket({ path, folders, files });
    // If the packet that requested the listing had no UUID of its own,
    // this reply might just go into the void (depending on whether the client awaits a reply or has an event listener)
    const originatorUUID = originator.getUUID();
    if (originatorUUID) reply.setReplyUUID(originatorUUID);
    void client.sendPacket(reply);
}
