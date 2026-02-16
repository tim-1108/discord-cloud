import { Client } from "./client/Client.js";
import type { UploadMetadata } from "../common/uploads.js";
import type { UUID } from "../common";
import { UploadFinishInfoPacket } from "../common/packet/s2c/UploadFinishInfoPacket.js";
import type { UploadFinishPacket } from "../common/packet/u2s/UploadFinishPacket.js";
import { ThumbnailService } from "./services/ThumbnailService.js";
import { logDebug, logError } from "../common/logging.js";
import { ClientList } from "./client/list.js";
import { ServiceRegistry } from "./services/list.js";
import { Database } from "./database/index.js";
import { ROOT_FOLDER_ID, type FolderOrRoot } from "./database/core.js";
import type { FileHandle } from "../common/supabase.js";
import { Authentication } from "./authentication.js";
import type { UploadBookingRequestPacket } from "../common/packet/c2s/UploadBookingRequestPacket.js";
import { UploadBookingPacket } from "../common/packet/s2c/UploadBookingPacket.js";
import type { UploadService } from "./services/UploadService.js";
import type { UploadRequestPacket } from "../common/packet/c2s/UploadRequestPacket.js";
import { Locks, type FileLockUUID } from "./lock.js";
import { UploadResponsePacket } from "../common/packet/s2c/UploadResponsePacket.js";
import { UploadBookingModifyPacket } from "../common/packet/s2c/UploadBookingModifyPacket.js";
import type { UploadBookingClearPacket } from "../common/packet/c2s/UploadBookingClearPacket.js";
import { GenericBooleanPacket } from "../common/packet/generic/GenericBooleanPacket.js";
import { pingServices } from "./pinging.js";
import type { UploadAbortRequestPacket } from "../common/packet/c2s/UploadAbortRequestPacket.js";
import type { UploadOverwriteResponsePacket } from "../common/packet/c2s/UploadOverwriteResponsePacket.js";
import { UploadOverwriteCancelPacket } from "../common/packet/s2c/UploadOverwriteCancelPacket.js";
import { UploadOverwriteRequestPacket } from "../common/packet/s2c/UploadOverwriteRequestPacket.js";
import { UploadStageFinishPacket } from "../common/packet/s2c/UploadStageFinishPacket.js";

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
    chunkSize: 10 * 1024 * 1024 - 1024,
    /**
     * If the client has kept more than this amount of files
     * within their overwrite queue without clearing it, any
     * other uploads above this count will just be aborted
     * if they also need to be overwritten.
     */
    maxOverwriteQueueSize: 512
};

export const Uploads = {
    request: requestUploadStart,
    finish: handleServiceUploadDone,
    chunkSize: () => Constants.chunkSize,
    handlers: {
        client: {
            disconnect: handleClientDisconnect,
            requestAbort: handleClientAbortRequest,
            overwriteResponse: handleClientOverwriteResponse
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

export type UploadOverwriteDefaultAction = "overwrite" | "rename" | "skip";

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

async function requestUploadServices(client: Client, packet: UploadBookingRequestPacket) {
    pingServices();
    // When a user has already booked uploaders, we only need to assign the
    // differenc between the values.
    // This packet only allows values greater than 0, so the user may never
    // "book" zero uploaders.
    const { desired_amount } = packet.getData();

    const reply = (count: number) => void client.replyToPacket(packet, new UploadBookingPacket({ amount: count }));

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
            const services = ServiceRegistry.predicatedList("upload", (s) => s.isBookedForClient(client));
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
    const services = ServiceRegistry.predicatedList("upload", (service) => !service.isBooked());
    for (const s of services) {
        s.bookForClient(client);
    }
    const b: BookingDetails = { desired_amount, current_amount: count };
    bookings.set(client.getUUID(), b);
    reply(count);
}

async function requestUploadStart(client: Client, packet: UploadRequestPacket) {
    const { name: desiredName, path, size, is_public, do_overwrite } = packet.getData();

    const fail = (reason?: string) => {
        const packet = new UploadResponsePacket({
            upload_id: crypto.randomUUID() /* utterly pointless */,
            accepted: false,
            chunk_size: Constants.chunkSize,
            name: desiredName,
            path,
            rejection_reason: reason
        });
        client.sendPacket(packet);
    };

    const service = ServiceRegistry.random.predicated("upload", (s) => !s.isBusy() && s.isBookedForClient(client));
    if (!service) {
        fail("No available service found. Have you booked any or are they still busy?");
        return;
    }

    const uuid = crypto.randomUUID();

    // By this point, we have neither performed a lookup whether the folder actually
    // exists, nor have we created the folder. That is so, if the upload is cancelled,
    // the folder does not just sit around. It is actually created whence the upload
    // is finished.
    const folderLockId = Locks.folder.lock(path);

    const metadata: UploadMetadata = {
        folder_lock_id: folderLockId,
        upload_id: uuid,
        chunk_size: Constants.chunkSize,
        client: client.getUUID(),
        desired_name: desiredName,
        is_public,
        size,
        path,
        do_overwrite
    };

    const request = await service.requestUploadStart(metadata);
    if (!request.data /* false or null */) {
        fail(request.error ?? "An unknown error whilst prompting upload service");
        return;
    }
    client.replyToPacket(
        packet,
        new UploadResponsePacket({
            upload_id: uuid,
            upload_address: service.getAddress(),
            accepted: request.data === true,
            rejection_reason: request.error ?? undefined,
            chunk_size: Constants.chunkSize,
            name: desiredName,
            path
        })
    );
}

function handleServiceDisconnect(bookedClient?: UUID) {
    if (!bookedClient) return;
    const client = ClientList.get(bookedClient);
    if (!client) return;
    const booking = bookings.get(client.getUUID());
    if (!booking) {
        throw new Error("No booking entry defined for client that had a service disconnect");
    }
    booking.current_amount--;
    client.sendPacket(new UploadBookingModifyPacket({ effective_change: -1 }));
}

function handleClientDisconnect(client: Client) {
    const booking = bookings.get(client.getUUID());
    if (!booking) return;
    // here, there is of course no need to decrement current_amount
    bookings.delete(client.getUUID());
    // We don't remove anything from runningOverwrites, as:
    // - it is not mapped to client id
    // - in there are only answered requests, and we can go
    //   and save them to the DB without any issue, even if
    //   the client disconnected.
    overwriteRequests.delete(client.getUUID());
    const services = ServiceRegistry.predicatedList("upload", (s) => s.isBookedForClient(client));
    if (services.length !== booking.current_amount) {
        throw new Error("current_amount incorrect upon client disconnect");
    }
    services.forEach(internal_serviceReleaseAndRedistribution);
}

async function handleClientAbortRequest(client: Client, packet: UploadAbortRequestPacket) {
    const { upload_id } = packet.getData();
    // There is no central list for uploads, so we essentially
    // have to ask the services nicely.
    const services = ServiceRegistry.predicatedList("upload", (s) => s.isBookedForClient(client));
    const s = services.find((s) => s.getUploadTaskUUID() === upload_id);

    if (!s) {
        client.replyToPacket(packet, new GenericBooleanPacket({ success: false, message: "The requested upload was not found for this client" }));
        return;
    }

    // TODO: yada yada yada locking of any of this whilst we are trying to terminate
    //       The user may just kill their connection in the meantime... (those few ms)
    const status = await s.abortUpload();
    client.replyToPacket(
        packet,
        new GenericBooleanPacket({ success: !status.error, message: status.error ? "Failed to terminate upload" : undefined })
    );
    if (status.error) {
        s.closeSocket(1000);
        return;
    }

    if (!status.metadata) {
        throw new ReferenceError("Metadata would have to be defined, because we know that an upload was running");
    }
    // The client now has the responsibility to request a new upload
    failUpload(status.metadata, "The user requested the upload to be aborted");
}

async function internal_serviceReleaseAndRedistribution(s: UploadService) {
    const result = await s.abortUpload();
    if (!result) {
        s.closeSocket(1000, "Failed to abort the running upload, going just a bit more extreme now.");
    } else {
        s.clearBooking();
        Uploads.handlers.service.initOrRelease(s);
    }
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

function handleClientRelease(client: Client, packet: UploadBookingClearPacket) {
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
    // Do not clear the overwrites for the user just because they released the services,
    // as there may still be unanswered overwrite requests.
    client.clearDefaultOverwriteAction();
    client.replyToPacket(packet, new GenericBooleanPacket({ success: true }));
}

// === Overwrite request queue ===

type UploadServiceOriginatingData = {
    messages: string[];
    type: string;
    hash: string;
    is_encrypted: boolean;
    channel: string;
};
type OverwriteData = {
    previousFileId: number;
    folderId: FolderOrRoot;
    lockId: FileLockUUID;
};
type OverwriteQueueItem = { metadata: UploadMetadata; uploadServiceData: UploadServiceOriginatingData; overwriteData: OverwriteData };
const overwriteRequests = new Map<UUID, Map<UUID, OverwriteQueueItem>>();
/**
 * This map contains the data for uploads that are currently in the process of saving
 * to the database. The idea behind this is to not have to pass `overwriteData` manually
 * to {@link failUpload} and {@link finalizeUpload} in so many places. These functions
 * will just look it up via {@link getAndDeleteRunningOverwrite}.
 */
const runningOverwrites = new Map<UUID, OverwriteData>();

async function handleClientOverwriteResponse(client: Client, packet: UploadOverwriteResponsePacket) {
    const { upload_id, use_on_all_uploads, action } = packet.getData();

    const map = overwriteRequests.get(client.getUUID());
    const item = map?.get(upload_id as UUID);
    if (!map || !item) return;

    map.delete(upload_id as UUID);
    runningOverwrites.set(item.metadata.upload_id, item.overwriteData);
    await submitFileToDatabase(item.metadata, item.uploadServiceData, action, item.overwriteData);

    if (!use_on_all_uploads) return;
    client.setDefaultOverwriteAction(action);
    client.sendPacket(new UploadOverwriteCancelPacket({}));
    // If we were to remove the items from map still stored there one at a time,
    // we would run the possiblity of the client sending another overwrite response
    // for something that is already being processed in this for loop.
    overwriteRequests.delete(client.getUUID());
    for (const { metadata, uploadServiceData, overwriteData } of map.values()) {
        runningOverwrites.set(metadata.upload_id, overwriteData);
        await submitFileToDatabase(metadata, uploadServiceData, action, overwriteData);
    }
}

function addOverwriteRequest(metadata: UploadMetadata, uploadServiceData: UploadServiceOriginatingData, overwriteData: OverwriteData): boolean {
    const clientId = metadata.client;
    let map = overwriteRequests.get(clientId);

    if (map && map.size >= Constants.maxOverwriteQueueSize) {
        return false;
    }

    if (!map) {
        map = new Map();
        overwriteRequests.set(clientId, map);
    }
    map.set(metadata.upload_id, { metadata, uploadServiceData, overwriteData });
    return true;
}

function getAndDeleteRunningOverwrite(uploadId: UUID): OverwriteData | null {
    const value = runningOverwrites.get(uploadId);
    if (!value) return null;
    runningOverwrites.delete(uploadId);
    return value;
}

// === Finish handling ===

async function handleServiceUploadDone(metadata: UploadMetadata, packet: UploadFinishPacket | string) {
    const client = ClientList.get(metadata.client);
    if (!client) return;

    // This is only used for when the service disconnected.
    // Here, we need not bother to send a stage finish,
    // as the upload service will disconnect anyhow.
    if (typeof packet === "string") {
        client.sendPacket(new UploadStageFinishPacket({ upload_id: metadata.upload_id, service_disconnect: true }));
        return failUpload(metadata, packet);
    }

    const data = packet.getData();

    // This means that the client can now send a new upload
    client.sendPacket(new UploadStageFinishPacket({ upload_id: metadata.upload_id }));
    if (!data.success) {
        return failUpload(metadata, data.reason);
    }

    if (
        typeof data.hash !== "string" ||
        typeof data.type !== "string" ||
        typeof data.channel !== "string" ||
        data.messages === undefined ||
        data.is_encrypted === undefined
    ) {
        failUpload(metadata, "Invalid metadata exchange between manager and service");
        return;
    }
    const uploadServiceData: UploadServiceOriginatingData = {
        hash: data.hash,
        type: data.type,
        channel: data.channel,
        messages: data.messages,
        is_encrypted: data.is_encrypted
    };

    const folderId = Database.folderId.get(metadata.path);
    if (folderId === null) {
        return submitFileToDatabase(metadata, uploadServiceData, "default");
    }

    const existingFile = await Database.file.get(folderId, metadata.desired_name);
    if (existingFile) {
        const lockId = Locks.file.lock(metadata.path, metadata.desired_name);
        const overwriteData: OverwriteData = { lockId, previousFileId: existingFile.id, folderId };
        const defaultAction = client.getDefaultOverwriteAction();

        if (metadata.do_overwrite) {
            return submitFileToDatabase(metadata, uploadServiceData, "overwrite", overwriteData);
        }

        if (defaultAction !== null) {
            return submitFileToDatabase(metadata, uploadServiceData, defaultAction, overwriteData);
        }
        // From this point on, we can just wait for this to resolve.
        // This is not implemented as a Promise to save resources.
        const flag = addOverwriteRequest(metadata, uploadServiceData, overwriteData);
        if (!flag) {
            failUpload(metadata, "The client exceeeded the maximum amount of files that may be enqueued for an overwrite decision");
            Locks.file.unlock(metadata.path, metadata.desired_name, lockId);
        }
        client.sendPacket(
            new UploadOverwriteRequestPacket({ upload_id: metadata.upload_id, file_name: metadata.desired_name, file_path: metadata.path })
        );
        return;
    }

    return submitFileToDatabase(metadata, uploadServiceData, "default");
}

async function submitFileToDatabase(
    metadata: UploadMetadata,
    data: UploadServiceOriginatingData,
    action: "overwrite" | "rename" | "skip" | "default",
    overwriteData?: OverwriteData
) {
    const client = ClientList.get(metadata.client);
    if (!client) {
        // The client will not be informed of the failure (they no longer exist), but
        // the necessary code for cleanup will run.
        failUpload(metadata, "Client disconnect");
        return;
    }

    // overwrite, rename and skip all originate from a overwrite request,
    // so they all have to have looked up an existing file at some point.
    if (action !== "default" && !overwriteData) {
        throw new ReferenceError("When calling with a pre-existing file, the overwriteData needs to be specified");
    }

    if (action === "skip") {
        return failUpload(metadata, "Client-configured skip");
    }

    const folderId = await Database.folderId.getOrCreate(metadata.path);
    if (folderId === null) {
        return failUpload(metadata, "Failed to create a folder within the desired route in the database");
    }

    const handle: Omit<FileHandle, "id" | "created_at" | "updated_at"> = {
        name: metadata.desired_name,
        size: metadata.size,
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
        owner: client.getUserId()
    };

    if (action === "overwrite") {
        const d = new Date();
        const previousHandle = await Database.file.getById(overwriteData!.previousFileId);
        if (previousHandle === null) {
            throw new ReferenceError(`Failed to aquire previous handle whilst it should have been locked: ${overwriteData!.previousFileId}`);
        }

        const ownership = await Authentication.permissions.ownership(client.getUserId(), previousHandle);
        if (!ownership) {
            throw new ReferenceError(`Failed to aquire ownership information for file: ${previousHandle.id}`);
        }
        const flag = Authentication.permissions.canWriteFile(ownership);
        if (!flag) {
            // If the user chose to overwrite a file whilst not actually
            // being allowed to, just fail for now.
            return failUpload(metadata, "You have insufficient permissions to overwrite this file");
        }

        // If the file was previously set as public without any owner,
        // this user will just claim it.
        handle.owner = previousHandle.owner ?? client.getUserId();

        const createdHandle = await Database.file.update(previousHandle.id, { ...handle, updated_at: d.toUTCString() });
        if (createdHandle === null) {
            // The file should not have been tampered with in the meantime.
            // The folder also should not have been able to be deleted,
            // as if any file within the folder is locked, the method
            // `contentStatus` of Locks.folder will return that.
            failUpload(metadata, "Failed to overwrite file");
            return;
        }

        if (previousHandle.folder !== createdHandle.folder) {
            throw new Error(
                `Previous folder id must not be different from new folder id on update. previous: ${previousHandle.folder} | now: ${createdHandle.folder}`
            );
        }
        // If the type has changed, of course, the size has to be fully removed from the old type.
        if (previousHandle.type === createdHandle.type) {
            Database.tree.fileTypes.modify(createdHandle.folder, createdHandle.type, createdHandle.size - previousHandle.size);
        } else {
            Database.tree.fileTypes.modify(createdHandle.folder, previousHandle.type, -previousHandle.size);
            Database.tree.fileTypes.modify(createdHandle.folder, createdHandle.type, createdHandle.size);
        }
        void Database.thumbnail.delete(overwriteData!.previousFileId);
        return finalizeUpload(createdHandle, metadata);
    }

    let targetName = metadata.desired_name;
    if (action === "rename") {
        const replacement = await Database.replacement.file(metadata.desired_name, overwriteData!.folderId, metadata.path);
        if (!replacement) {
            return failUpload(metadata, "Failed to find a replacement name");
        }
        targetName = replacement;
    }

    handle.name = targetName;
    const createdHandle = await Database.file.add(handle);
    if (createdHandle === null) {
        return failUpload(metadata, "Failed to insert file into database");
    }
    Database.tree.fileTypes.modify(createdHandle.folder, createdHandle.type, createdHandle.size);
    finalizeUpload(createdHandle, metadata);
}

function finalizeUpload(handle: FileHandle, metadata: UploadMetadata) {
    // The file should actually only be unlocked down here.
    // Saving to db may take some time, we do not want any
    // shenanigang to be able to start in that time.
    if (metadata.folder_lock_id) {
        Locks.folder.unlock(metadata.path, metadata.folder_lock_id);
    }

    const overwriteData = getAndDeleteRunningOverwrite(metadata.upload_id);
    if (overwriteData) {
        Locks.file.unlock(metadata.path, metadata.desired_name, overwriteData.lockId);
    }

    // At this point, the upload would not fail if the client disconnected.
    // We still can easily process it and can be sure that the client did want it uploaded.
    const client = ClientList.get(metadata.client);
    if (client) {
        // Although the actual file addition is communicated via the file-modify packet,
        // the user could be notified via this that their file has been renamed to this new name.
        const renameTarget = handle.name !== metadata.desired_name ? handle.name : undefined;
        void client.sendPacket(new UploadFinishInfoPacket({ success: true, upload_id: metadata.upload_id, rename_target: renameTarget }));
    }

    // Next, we contact our thumbnail service to have a screenshot generated
    // We will not be waiting here for a response, as that might get queued
    // up or take a long time. Thus, the packet receiver will handle that.
    if (!ThumbnailService.shouldGenerateThumbnail(handle.type)) return;
    void ThumbnailService.enqueueOrSendToRandom(handle);
}

function failUpload(metadata: UploadMetadata, reason?: string) {
    const client = ClientList.get(metadata.client);
    if (metadata.folder_lock_id) {
        Locks.folder.unlock(metadata.path, metadata.folder_lock_id);
    }
    const overwriteData = getAndDeleteRunningOverwrite(metadata.upload_id);
    if (overwriteData) {
        Locks.file.unlock(metadata.path, metadata.desired_name, overwriteData.lockId);
    }
    logDebug("Failed upload for", metadata.path, metadata.desired_name);
    if (!client) return;
    // The client is responsible for pushing a new upload once this has failed
    // (depending on whether the service disconnected, that is communicated in serviceDisconnect)
    void client.sendPacket(new UploadFinishInfoPacket({ success: false, upload_id: metadata.upload_id, reason }));
}
