import { Client } from "./client/Client.js";
import type { UploadMetadata } from "../common/uploads.js";
import type { UUID } from "../common";
import { UploadFinishInfoPacket } from "../common/packet/s2c/UploadFinishInfoPacket.js";
import type { UploadFinishPacket } from "../common/packet/u2s/UploadFinishPacket.js";
import { ThumbnailService } from "./services/ThumbnailService.js";
import { logDebug, logError, logWarn } from "../common/logging.js";
import { ClientList } from "./client/list.js";
import { ServiceRegistry } from "./services/list.js";
import { Database } from "./database/index.js";
import { ROOT_FOLDER_ID } from "./database/core.js";
import type { FileHandle } from "../common/supabase.js";
import { Authentication } from "./authentication.js";
import type { UploadServicesRequestPacket } from "../common/packet/c2s/UploadServicesRequestPacket.js";
import { UploadServicesPacket } from "../common/packet/s2c/UploadServicesPacket.js";
import type { UploadService } from "./services/UploadService.js";
import type { UploadRequestPacket } from "../common/packet/c2s/UploadRequestPacket.js";
import { Locks } from "./lock.js";
import { UploadResponsePacket } from "../common/packet/s2c/UploadResponsePacket.js";
import { UploadBookingModifyPacket } from "../common/packet/s2c/UploadBookingModifyPacket.js";
import type { UploadServicesReleasePacket } from "../common/packet/c2s/UploadServicesReleasePacket.js";
import { GenericBooleanPacket } from "../common/packet/generic/GenericBooleanPacket.js";
import { pingServices } from "./pinging.js";

const Constants = {
    /**
     * Discord currently allows 10MB uploads per message-
     * Accordingly, we split the file into chunks of this size.
     *
     * However, as this is the size the client sends us, we have
     * to allow for some padding for the IV and AES chunks.
     * Note that 1kb is most likely too large, but this does
     * not have any real impact.
     */
    chunkSize: 10 * 1024 * 1024 - 1024
};

export const Uploads = {
    request: requestUploadStart,
    fail: failUpload,
    finish: finishUpload,
    chunkSize: () => Constants.chunkSize,
    handlers: {
        client: {
            disconnect: handleClientDisconnect
        },
        service: {
            initOrRelease: handleServiceInitOrRelease,
            disconnect: handleServiceDisconnect
        }
    },
    booking: {
        request: requestUploadServices,
        release: handleClientRelease
    }
} as const;

type BookingDetails = {
    desired_amount: number;
    current_amount: number;
};
const bookings = new Map<UUID, BookingDetails>();
function getOrWriteBooking(client: Client) {
    const value = bookings.get(client.getUUID());
    if (value) {
        return value;
    }
    const $value: BookingDetails = { desired_amount: 0, current_amount: 0 };
    bookings.set(client.getUUID(), $value);
    return $value;
}

async function requestUploadServices(client: Client, packet: UploadServicesRequestPacket) {
    pingServices();
    // When a user has already booked uploaders, we only need to assign the
    // differenc between the values.
    // This packet only allows values greater than 0, so the user may never
    // "book" zero uploaders.
    const { desired_amount } = packet.getData();

    const reply = (count: number) => void client.replyToPacket(packet, new UploadServicesPacket({ count }));

    let needed = desired_amount;
    const ab = bookings.get(client.getUUID());
    if (ab) {
        const delta = desired_amount - ab.desired_amount;
        // Nothing has actually changed about the booking.
        // Also, we do not try to book other services as that
        // would be pointless right now (they are automatically)
        if (delta === 0) {
            return reply(ab.current_amount);
        }
        // user actually wants to reduce their amount
        if (delta < 0) {
            // no modification needed then (current amount does not need to change)
            if (ab.current_amount <= desired_amount) {
                ab.desired_amount = desired_amount;
                reply(ab.current_amount);
                return;
            }
            // now we actually need to free uploaders
            const count = ab.current_amount - desired_amount;
            // note that we do not look for just idle services!
            // if the user submits such a packet while their uploads are
            // running, we will force stop them.
            const services = ServiceRegistry.random.multiple("upload", count, (s) => s.isBookedForClient(client));
            if (!services) {
                throw new RangeError(
                    "Incorrect value stored in current_amount, not as many uploaders are booked: " +
                        ab.current_amount +
                        " | new_desired: " +
                        desired_amount +
                        " | stored_desired: " +
                        ab.desired_amount
                );
            }
            ab.desired_amount = desired_amount;
            ab.current_amount = desired_amount;
            services.forEach(internal_serviceReleaseAndRedistribution);
            return reply(desired_amount);
        }
        // Now, the user wants to add to their current amount.
        // For determining this amount, we know that if the
        // current_amount does not match the previously desired amount,
        // there are no other services free that we can book and we
        // need not bother. If a service should then become free,
        // the corresponding handler function will deal with that
        // and assign it to a random client that needs it.
        if (ab.current_amount !== ab.desired_amount) {
            ab.desired_amount = desired_amount;
            return reply(ab.current_amount);
        }
        // the amount of services we need to book now to fit the
        // count requested by the client
        needed = desired_amount - ab.desired_amount;
    }

    const free = ServiceRegistry.count("upload", (service) => !service.isBooked());
    const count = Math.min(needed, free.idle);
    if (free.idle === 0) {
        // here, we should not write the "needed" variable, instead
        // always the full amount of services desired
        getOrWriteBooking(client).desired_amount = desired_amount;
        return reply(0);
    }
    const services = ServiceRegistry.random.multiple("upload", count, (service) => !service.isBooked());
    if (services === null) {
        throw new RangeError("Expected to get a certain amount of non-booked uploaders, but received less");
    }
    for (const s of services) {
        s.bookForClient(client);
    }
    const b: BookingDetails = { desired_amount, current_amount: count };
    bookings.set(client.getUUID(), b);
    reply(count);
}

async function requestUploadStart(client: Client, packet: UploadRequestPacket) {
    const { name: name_doNotUseMe, path, size, is_public, do_overwrite } = packet.getData();

    const fail = (reason?: string) => {
        const packet = new UploadResponsePacket({
            upload_id: crypto.randomUUID() /* utterly pointless */,
            accepted: false,
            chunk_size: Constants.chunkSize,
            name: name_doNotUseMe,
            path,
            rejection_reason: reason
        });
        client.sendPacket(packet);
    };

    const existingFile = await Database.file.getWithPath(name_doNotUseMe, path);

    const isLocked = Locks.file.status(path, name_doNotUseMe);

    let targetName = name_doNotUseMe;
    let overwriteFileId: number | null = null;
    let overwriteUserId: number | null = null;
    existing: if (existingFile !== null) {
        if (do_overwrite) {
            if (isLocked) {
                fail("File is locked");
                return;
            }
            const ownership = await Authentication.permissions.ownership(client.getUserId(), existingFile);
            if (!Authentication.permissions.canWriteFile(ownership)) {
                fail("You cannot overwrite this file");
                return;
            }
            overwriteFileId = existingFile.id;
            overwriteUserId = existingFile.owner;
            break existing;
        }
        if (!isLocked) Locks.file.lock(path, name_doNotUseMe);
        const attempt = await Database.replacement.file(name_doNotUseMe, existingFile.folder ?? "root", path);
        if (attempt === null) {
            // Only if it was previously unlocked, we unlock it again!
            if (!isLocked) Locks.file.unlock(path, name_doNotUseMe);
            fail("No possible replacement file name found");
            return;
        }
        targetName = attempt;
    }

    Locks.file.lock(path, targetName);

    const service = ServiceRegistry.random.predicated("upload", (s) => !s.isBusy() && s.isBookedForClient(client));
    if (!service) {
        fail("No available service found. Have you booked any or are they still busy?");
        Locks.file.unlock(path, targetName);
        return;
    }

    const uuid = crypto.randomUUID();

    const metadata: UploadMetadata = {
        upload_id: uuid,
        chunk_size: Constants.chunkSize,
        overwrite_target: overwriteFileId,
        overwrite_user_id: overwriteUserId,
        client: client.getUUID(),
        name: targetName,
        is_public,
        size,
        path
    };

    const request = await service.requestUploadStart(metadata);
    if (!request.data /* false or null */) {
        fail(request.error ?? "An unknown error whilst prompting upload service");
        return;
    }
    const renameTarget = targetName !== name_doNotUseMe ? targetName : undefined;
    client.replyToPacket(
        packet,
        new UploadResponsePacket({
            upload_id: uuid,
            upload_address: service.getAddress(),
            rename_target: renameTarget,
            accepted: request.data === true,
            rejection_reason: request.error ?? undefined,
            chunk_size: Constants.chunkSize,
            name: targetName,
            path
        })
    );
}

function handleServiceDisconnect(bookedClient?: UUID) {
    client_cond: if (bookedClient) {
        const client = ClientList.get(bookedClient);
        if (!client) break client_cond;
        const booking = bookings.get(client.getUUID());
        if (!booking) {
            throw new Error("No booking entry defined for client that had a service disconnect");
        }
        booking.current_amount--;
        client.sendPacket(new UploadBookingModifyPacket({ effective_change: -1 }));
    }
}

function handleClientDisconnect(client: Client) {
    const booking = bookings.get(client.getUUID());
    if (!booking) return;
    // here, there is of course no need to decrement current_amount
    bookings.delete(client.getUUID());
    const services = ServiceRegistry.random.multiple("upload", booking.current_amount, (s) => s.isBookedForClient(client));
    if (!services) {
        throw new Error("current_amount incorrect upon client disconnect");
    }
    services.forEach(internal_serviceReleaseAndRedistribution);
}

async function internal_serviceReleaseAndRedistribution(s: UploadService) {
    s.clearBooking();
    const result = await s.abortUpload();
    if (!result) {
        s.closeSocket(1000, "Failed to abort the running upload, going just a bit more extreme now.");
    }
    Uploads.handlers.service.initOrRelease(s);
}

/**
 * This function attempts to book the service that just connected
 * to a client that has a `desired_amount` that is greater than its
 * `current_amount`. The client is notified of that change and can
 * then proceed to add another active upload.
 */
function handleServiceInitOrRelease(service: UploadService) {
    const clients = Array.from(bookings.entries()).filter(([_, b]) => b.current_amount < b.desired_amount);
    // Great, we need to do nothing, all clients
    // are fully booked up!
    if (!clients.length) {
        return;
    }
    const index = Math.floor(Math.random() * clients.length);
    const [uuid, booking] = clients[index];
    const client = ClientList.get(uuid);
    if (!client) {
        // yeah, we'll just fail here.
        // This should not happen as whenever a client disconnects, their
        // bookings are also instantly removed and their services redistributed
        logError("Invalid client listed in bookings registry", uuid);
        return;
    }
    booking.current_amount++;
    service.bookForClient(client);
    client.sendPacket(new UploadBookingModifyPacket({ effective_change: 1 }));
}

function handleClientRelease(client: Client, packet: UploadServicesReleasePacket) {
    const booking = bookings.get(client.getUUID());
    if (!booking) {
        client.replyToPacket(packet, new GenericBooleanPacket({ success: false, message: "No booking recorded for this client" }));
        return;
    }
    const services = ServiceRegistry.predicatedList("upload", (s) => s.isBookedForClient(client));
    if (services.length !== booking.current_amount) {
        logError(`Invalid current_amount set in booking for ${client.getUUID()}`, booking, services.length);
    }
    services.forEach(internal_serviceReleaseAndRedistribution);
    bookings.delete(client.getUUID());
    client.replyToPacket(packet, new GenericBooleanPacket({ success: true }));
}

async function finishUpload(metadata: UploadMetadata, packet: UploadFinishPacket) {
    const client = ClientList.get(metadata.client);
    if (!client) return;

    logDebug("Finished upload for", metadata.path, metadata.name);

    const data = packet.getData();

    // TODO: Make channel required
    if (typeof data.hash !== "string" || typeof data.type !== "string" || typeof data.channel !== "string") {
        failUpload(metadata, "Invalid metadata exchange between manager and service");
        return;
    }

    const { name, path, size } = metadata;
    const folderId = await Database.folder.getOrCreateByPath(path);
    if (folderId === null) {
        failUpload(metadata, "Failed to create folder in database");
        return;
    }

    // It may also be that the file, if overwritten, had no user assigned to it.
    // If so, we assign it to them here.
    const user = await Database.user.get(metadata.overwrite_user_id ?? client.getUserId());
    if (!user) {
        failUpload(metadata, "Owner of the file no longer exists");
        return;
    }

    const handle: Omit<FileHandle, "id" | "created_at" | "updated_at"> = {
        name,
        size,
        folder: folderId === ROOT_FOLDER_ID ? null : folderId,
        is_encrypted: data.is_encrypted ?? false,
        hash: data.hash,
        type: data.type,
        channel: data.channel,
        // TODO: See UploadFinishPacket's code for safe re-implemntation idea
        messages: data.messages ?? [],
        // Even when overwriting, this should be false
        has_thumbnail: false,
        is_public: metadata.is_public,
        owner: user.id
    };

    // The client is responsible for pushing a new upload once this has finished
    void client.sendPacket(new UploadFinishInfoPacket({ success: true, upload_id: metadata.upload_id }));

    let $handle: FileHandle | null;
    if (metadata.overwrite_target !== null) {
        const d = new Date();
        $handle = await Database.file.update(metadata.overwrite_target, { ...handle, updated_at: d.toUTCString() });
        if ($handle === null) {
            // The file should not have been tampered with in the meantime.
            // The folder also should not have been able to be deleted,
            // as if any file within the folder is locked, the method
            // `contentStatus` of Locks.folder will return that.
            failUpload(metadata, "Failed to overwrite file");
            return;
        }
        void Database.thumbnail.delete(metadata.overwrite_target);
    } else {
        $handle = await Database.file.add(handle);
        if ($handle === null) {
            failUpload(metadata, "Failed to insert file into database");
            return;
        }
    }

    // The file should actually only be unlocked down here.
    // Saving to db may take some time, we do not want any
    // shenanigang to be able to start in that time.
    Locks.file.unlock(metadata.path, metadata.name);

    // Next, we contact our thumbnail service to have a screenshot generated
    // We will not be waiting here for a response, as that might get queued
    // up or take a long time. Thus, the packet receiver will handle that.
    if (!ThumbnailService.shouldGenerateThumbnail($handle.type)) return;
    void ThumbnailService.enqueueOrSendToRandom($handle);
}

function failUpload(metadata: UploadMetadata, reason?: string) {
    const client = ClientList.get(metadata.client);
    Locks.file.unlock(metadata.path, metadata.name);
    if (!client) return;
    logDebug("Failed upload for", metadata.path, metadata.name);
    // The client is responsible for pushing a new upload once this has failed
    // (depending on whether the service disconnected, that is communicated in serviceDisconnect)
    void client.sendPacket(new UploadFinishInfoPacket({ success: false, upload_id: metadata.upload_id, reason }));
}
