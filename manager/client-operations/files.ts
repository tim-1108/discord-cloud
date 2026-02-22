import { logError } from "../../common/logging.js";
import type { FileSharePacket } from "../../common/packet/c2s/FileSharePacket.js";
import type { SignedDownloadRequestPacket } from "../../common/packet/c2s/SignedDownloadRequestPacket.js";
import type { TransferOwnershipPacket } from "../../common/packet/c2s/TransferOwnershipPacket.js";
import { GenericBooleanPacket } from "../../common/packet/generic/GenericBooleanPacket.js";
import { SignedDownloadPacket } from "../../common/packet/s2c/SignedDownloadPacket.js";
import type { FileShareHandle } from "../../common/supabase.js";
import { Authentication } from "../authentication.js";
import type { Client } from "../client/Client.js";
import { Database } from "../database/index.js";
import { Locks } from "../lock.js";
import { SignedDownload } from "../signed-download.js";

export async function performFileShareOperation(client: Client, packet: FileSharePacket) {
    const reply = (success: boolean, message?: string) => client.replyToPacket(packet, new GenericBooleanPacket({ success, message }));

    const user = client.getUserId();
    const { target_user, path, name, can_write, is_deleting } = packet.getData();

    if (Locks.file.individualStatus(path, name)) {
        return reply(false, "This file is presently locked");
    }
    const lockId = Locks.file.lock(path, name);

    const handle = await Database.file.get(path, name);
    if (!handle) {
        Locks.file.unlock(path, name, lockId);
        return reply(false, "The file does not exist");
    }

    const ownership = await Authentication.permissions.ownership(user, handle);
    if (!ownership || ownership.status !== "owned") {
        Locks.file.unlock(path, name, lockId);
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
    Locks.file.unlock(path, name, lockId);
    return reply($handle !== null);
}

export async function performTransferOwnershipOperation(client: Client, packet: TransferOwnershipPacket) {
    const reply = (success: boolean, message?: string) => client.replyToPacket(packet, new GenericBooleanPacket({ success, message }));
    const { file_id, target_user_id, delete_file_shares, create_share_for_current_owner } = packet.getData();

    const handle = await Database.file.getById(file_id);
    if (!handle) {
        return reply(false, "No file was found for the specified id");
    }

    // If there is no user assigned (the user was deleted),
    // any user may transfer ownership to anybody, even themselves
    const skipUserCheck = handle.owner === null;
    const originUserId = client.getUserId();
    if (originUserId !== handle.owner && !skipUserCheck) {
        return reply(false, "You are not the owner of this file");
    }

    const route = await Database.folder.resolveRouteById(handle.folder ?? "root");
    if (!route) {
        return reply(false, "Failed to build route to file");
    }

    // We only want to prevent this operation if the file itself is locked.
    // If the folder is locked (an upload is happening or even in a case
    // where the folder is being deleted, why care?)
    if (Locks.file.individualStatus(route, handle.name)) {
        return reply(false, "This file is presently locked");
    }

    const lockId = Locks.file.lock(route, handle.name);
    const targetUser = await Database.user.get(target_user_id);

    if (!targetUser) {
        return reply(false, "The target user was not found");
    }
    if (targetUser.id === originUserId && !skipUserCheck) {
        return reply(false, "The target and user running this are identical");
    }

    if (delete_file_shares) {
        await Database.file.share.deleteAll(handle.id);
    } else {
        await Database.file.share.delete(targetUser.id, handle.id);
    }

    if (create_share_for_current_owner && handle.owner) {
        await Database.file.share.insert(handle.owner, handle.id, true);
    }

    // In a perfect world, we would have some sort of staging area for
    // all the changes to file shares we are doing above. But here, we
    // just pray for this call to actually work because this update
    // will then emit to all clients their new status with this file.
    // (e.g. that their share has been removed)
    // Also: the user could technically be deleted in that time,
    //       but that ain't happening.
    const updatedHandle = await Database.file.update(handle.id, { owner: targetUser.id });
    Locks.file.unlock(route, handle.name, lockId);
    if (!updatedHandle) {
        logError("Failed to update file handle when transferring ownership, file shares may be gone:", packet.getData());
        reply(false, "We failed to update the file handle, sorry");
    } else {
        reply(true);
    }
}

export async function performSignedDownloadOperation(client: Client, packet: SignedDownloadRequestPacket) {
    const reply = (payload?: string) => client.sendPacket(new SignedDownloadPacket({ payload }));

    const { file_id } = packet.getData();

    const handle = await Database.file.getById(file_id);
    if (!handle) {
        return reply();
    }

    if (handle.owner !== client.getUserId()) {
        const { read } = await Authentication.permissions.file(client.getUserId(), handle.id);
        if (!read) {
            return reply();
        }
    }

    const payload = SignedDownload.generate(handle);
    reply(payload);
}
