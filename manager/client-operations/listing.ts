import type { ListRequestPacket } from "../../common/packet/c2s/ListRequestPacket.js";
import type { Client } from "../client/Client.js";
import { ListPacket } from "../../common/packet/s2c/ListPacket.js";
import { listSubfolders } from "../database/public.js";
import { Database } from "../database/index.js";
import type { ClientFileHandle } from "../../common/client.js";
import { Authentication } from "../authentication.js";
import { ThumbnailService } from "../services/ThumbnailService.js";
import type { FolderStatusRequestPacket } from "../../common/packet/c2s/FolderStatusRequestPacket.js";
import { FolderStatusPacket } from "../../common/packet/s2c/FolderStatusPacket.js";
import { ListFilesPacket } from "../../common/packet/s2c/ListFilesPacket.js";
import { ListFoldersPacket } from "../../common/packet/s2c/ListFoldersPacket.js";
import type { FolderSizeRequestPacket } from "../../common/packet/c2s/FolderSizeRequestPacket.js";
import { FolderSizePacket } from "../../common/packet/s2c/FolderSizePacket.js";

export const ListingClientOperations = {
    folderStatus,
    listRequest,
    folderSize
} as const;

/**
 * How big one page is considered
 */
const PAGE_SIZE = 100 as const;

async function folderStatus(client: Client, packet: FolderStatusRequestPacket) {
    const { path } = packet.getData();
    const fid = await Database.folder.getByPath(path);
    const invalidReply = new FolderStatusPacket({ path, exists: false, file_count: 0, subfolder_count: 0, page_size: PAGE_SIZE, folder_id: null });
    if (fid === null) {
        client.replyToPacket(packet, invalidReply);
        return;
    }
    const subfolders = await Database.folder.counts.subfolders(fid);
    const files = await Database.folder.counts.files(fid);
    if (subfolders === null || files === null) {
        client.replyToPacket(packet, invalidReply);
        return;
    }
    client.replyToPacket(
        packet,
        new FolderStatusPacket({
            path,
            exists: true,
            file_count: files,
            subfolder_count: subfolders,
            page_size: PAGE_SIZE,
            folder_id: fid === "root" ? null : fid
        })
    );
}

async function folderSize(client: Client, packet: FolderSizeRequestPacket) {
    const { folder_id } = packet.getData();
    if (folder_id !== null) {
        const handle = await Database.folder.getById(folder_id);
        if (!handle) return;
    }
    const types = Database.tree.getCombinedSizes(folder_id);
    const record: Record<string, number> = {};
    let totalSize = 0;
    for (const [type, size] of types) {
        record[type] = size;
        totalSize += size;
    }
    client.replyToPacket(packet, new FolderSizePacket({ total_size: totalSize, types: record, folder_id }));
}

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
async function listRequest(client: Client, packet: ListRequestPacket): Promise<void> {
    const { path, type, page, sort_by, ascending_sort } = packet.getData();
    const $type = type as "subfolders" | "files";
    const folderId = await Database.folder.getByPath(path);
    // The client is expected to have sent a FolderStatusRequest packet beforehand.
    // If this folder does not exist, we'll tell the client
    if (!folderId) return;

    const fail = () => {
        const obj = { success: false, page, path };
        const reply = $type === "files" ? new ListFilesPacket({ ...obj, files: [] }) : new ListFoldersPacket({ ...obj, folders: [] });
        client.replyToPacket(packet, reply);
    };

    // As page 0 is the first page, 0 * PAGE_SIZE will be correct
    const pagination = { limit: PAGE_SIZE, offset: page * PAGE_SIZE };

    if ($type === "subfolders") {
        const sortBy = sort_by === "name" ? { field: "name", ascending: ascending_sort } : undefined;
        const folders = await Database.folder.listing.subfolders(folderId, sortBy, pagination);
        if (folders === null) return fail();
        client.replyToPacket(packet, new ListFoldersPacket({ folders, path, page, success: true }));
        return;
    }

    const sortBy = sort_by ? { field: sort_by, ascending: ascending_sort } : undefined;
    const files = await Database.folder.listing.files(folderId, sortBy, pagination);
    if (files === null) return fail();

    const $files = await Promise.all<ClientFileHandle | null>(
        files.map(async (f) => {
            // TODO: Unify this ClientFileHandle generation with the broadcast in file.ts
            const o = await Authentication.permissions.ownership(client.getUserId(), f);
            if (o === null) {
                return null;
            }

            // Whenever a file is viewed, we might just try to generate a thumbnail
            // for it. If that succedes, a file modify packet will be emitted to all
            // clients and thus they will render that thumbnail (shortly after).
            if (!f.has_thumbnail && ThumbnailService.shouldGenerateThumbnail(f.type)) {
                void ThumbnailService.enqueueOrSendToRandom(f);
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
    client.replyToPacket(packet, new ListFilesPacket({ success: true, files: $files.filter((v) => v !== null), path, page }));
}
