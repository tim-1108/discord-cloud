import type { ThumbnailRequestPacket } from "../../common/packet/c2s/ThumbnailRequestPacket.js";
import { GenericBooleanPacket } from "../../common/packet/generic/GenericBooleanPacket";
import { Authentication } from "../authentication.js";
import type { Client } from "../client/Client.js";
import { Database } from "../database/index.js";

export async function performThumbnailRequestOperation(client: Client, packet: ThumbnailRequestPacket): Promise<void> {
    const fail = (message?: string) => void client.replyToPacket(packet, new GenericBooleanPacket({ success: false, message }));
    const { id } = packet.getData();
    const handle = await Database.file.getById(id);
    if (!handle) {
        return fail("File not found");
    }
    if (!handle.has_thumbnail) {
        return fail("File has no thumbnail");
    }
    const o = await Authentication.permissions.ownership(client.getUserId(), handle);
    if (!o || !Authentication.permissions.canReadFile(o)) {
        return fail("Access denied");
    }
    const url = await Database.thumbnail.getSignedLink(id);
    if (!url) {
        return fail("Failed to get url");
    }
    void client.replyToPacket(packet, new GenericBooleanPacket({ success: true, message: url }));
}
