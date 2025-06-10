import type { ListRequestPacket } from "../../common/packet/c2s/ListRequestPacket.js";
import { resolvePathToFolderId_Cached } from "../database/core.js";
import type { Client } from "../client/Client.js";
import { ListPacket } from "../../common/packet/s2c/ListPacket.js";
import { listSubfolders } from "../database/public.js";
import { Database } from "../database/index.js";
import type { ClientFileHandle, ClientFolderHandle } from "../../common/client.js";
import { Authentication } from "../authentication.js";

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
    const files = await Database.file.listInFolder(folderId);

    if (!files || !folders) {
        return sendReplyPacket(client, packet, [], [], false);
    }

    const $files = await Promise.all<ClientFileHandle | null>(
        files.map(async (f) => {
            // TODO: Unify this ClientFileHandle generation with the broadcast in file.ts
            const o = await Authentication.permissions.ownership(client.getUserId(), f);
            if (o === null) {
                return null;
            }
            return {
                id: f.id,
                name: f.name,
                type: f.type,
                has_thumbnail: f.has_thumbnail,
                created_at: f.created_at,
                updated_at: f.updated_at,
                size: f.size,
                ownership: o
                // thumbnail_url is not sent here by design
            };
        })
    );

    sendReplyPacket(
        client,
        packet,
        folders,
        $files.filter((v) => v !== null),
        true
    );
}

function sendReplyPacket(
    client: Client,
    originator: ListRequestPacket,
    folders: ClientFolderHandle[],
    files: ClientFileHandle[],
    success: boolean = true
) {
    const { path } = originator.getData();
    const reply = new ListPacket({ path, folders, files, success });
    // If the packet that requested the listing had no UUID of its own,
    // this reply might just go into the void (depending on whether the client awaits a reply or has an event listener)
    const originatorUUID = originator.getUUID();
    if (originatorUUID) reply.setReplyUUID(originatorUUID);
    void client.sendPacket(reply);
}
