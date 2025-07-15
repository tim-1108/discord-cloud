import type { FileSharePacket } from "../../common/packet/c2s/FileSharePacket.js";
import { GenericBooleanPacket } from "../../common/packet/generic/GenericBooleanPacket.js";
import type { FileShareHandle } from "../../common/supabase.js";
import { Authentication } from "../authentication.js";
import type { Client } from "../client/Client.js";
import { Database } from "../database/index.js";

export async function performFileShareOperation(client: Client, packet: FileSharePacket) {
    const reply = (success: boolean, message?: string) => client.replyToPacket(packet, new GenericBooleanPacket({ success, message }));

    // General notice:
    // Should a lock on certain things (like file shares or files) be enforced while we are doing things with
    // the file. For instance, if the removal of this share is in process (request to db) and another packet
    // comes in attempting to modify the file share, would that possibly be an issue?? (in an imaginary situation
    // where there is a huge delay when sending requests to db)

    const user = client.getUserId();
    const { target_user, path, name, can_write, is_deleting } = packet.getData();
    const handle = await Database.file.getWithPath(name, path);
    if (!handle) {
        return reply(false, "The file does not exist");
    }

    const ownership = await Authentication.permissions.ownership(user, handle);
    if (!ownership || ownership.status !== "owned") {
        return reply(false, "You do not own this file");
    }

    let $handle: FileShareHandle | null;
    if (is_deleting) {
        $handle = await Database.file.share.delete(target_user, handle.id);
    } else if (typeof can_write === "boolean") {
        // we are modifying the data here
        $handle = await Database.file.share.update(target_user, handle.id, can_write);
    } else {
        $handle = await Database.file.share.insert(
            target_user,
            handle.id,
            can_write ?? false /* typescript does not detect it, but can_write is a bool */
        );
    }
    return reply($handle !== null);
}
