import type { ListRequestPacket } from "../../common/packet/c2s/ListRequestPacket.js";
import { resolvePathToFolderId_Cached } from "../database/core.js";
import type { Client } from "../client/Client.js";
import { ListPacket } from "../../common/packet/s2c/ListPacket.js";
import type { FileHandle, FolderHandle } from "../../common/supabase.js";
import { listFilesAtDirectory, listSubfolders } from "../database/public.js";

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
    if (!folderId) return sendReplyPacket(client, packet, [], [], false);

    const folders = await listSubfolders(folderId);
    const files = await listFilesAtDirectory(folderId);

    if (!files || !folders) {
        return sendReplyPacket(client, packet, [], [], false);
    }

    sendReplyPacket(client, packet, folders, files, true);
}

function sendReplyPacket(client: Client, originator: ListRequestPacket, folders: FolderHandle[], files: FileHandle[], success: boolean = true) {
    const { path } = originator.getData();
    const reply = new ListPacket({ path, folders, files, success });
    // If the packet that requested the listing had no UUID of its own,
    // this reply might just go into the void (depending on whether the client awaits a reply or has an event listener)
    const originatorUUID = originator.getUUID();
    if (originatorUUID) reply.setReplyUUID(originatorUUID);
    void client.sendPacket(reply);
}
