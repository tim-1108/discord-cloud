import type { DataErrorFields } from "../../../common";
import type { ClientFileHandle, ClientFolderHandle } from "../../../common/client";
import { FolderSizeRequestPacket } from "../../../common/packet/c2s/FolderSizeRequestPacket";
import { FolderStatusRequestPacket } from "../../../common/packet/c2s/FolderStatusRequestPacket";
import { ListRequestPacket } from "../../../common/packet/c2s/ListRequestPacket";
import { FolderSizePacket } from "../../../common/packet/s2c/FolderSizePacket";
import { FolderStatusPacket } from "../../../common/packet/s2c/FolderStatusPacket";
import { ListFilesPacket } from "../../../common/packet/s2c/ListFilesPacket";
import { ListFoldersPacket } from "../../../common/packet/s2c/ListFoldersPacket";
import { createMapFromNamedArray } from "../../../common/useless";
import { getOrCreateCommunicator } from "./authentication";
import { convertRouteToPath } from "./path";

export interface ListingMetadata {
    subfolder_count: number;
    file_count: number;
    page_size: number;
    folder_id: number | null;
}

export type ListingError = {
    message: string;
    can_retry?: boolean;
    can_create?: boolean;
};

export const UncachedListing = {
    init,
    getPage,
    getSizes,
    modify: {}
};

async function init(path: string[] | string): Promise<DataErrorFields<ListingMetadata, ListingError>> {
    path = typeof path === "string" ? path : convertRouteToPath(path);

    const com = await getOrCreateCommunicator();
    const res = await com.sendPacketAndReply_new(new FolderStatusRequestPacket({ path }), FolderStatusPacket);
    if (!res.packet) {
        return { error: { message: res.error, can_retry: true }, data: null };
    }
    const { exists, subfolder_count, file_count, page_size, folder_id } = res.packet.getData();
    if (!exists) {
        return { error: { message: "The folder does not exist", can_create: true }, data: null };
    }
    const data: ListingMetadata = {
        subfolder_count,
        folder_id,
        file_count,
        page_size
    };
    return { error: null, data };
}

export type GetSizeReturn = Omit<FolderSizePacket["data"], "folder_id">;
async function getSizes(id: number | null): Promise<DataErrorFields<GetSizeReturn, string>> {
    const com = await getOrCreateCommunicator();
    const res = await com.sendPacketAndReply_new(new FolderSizeRequestPacket({ folder_id: id }), FolderSizePacket);
    if (!res.packet) {
        return { error: res.error, data: null };
    }
    const { folder_id, ...data } = res.packet.getData();
    return { data, error: null };
}

type Sort<T extends "files" | "subfolders"> = {
    field: T extends "files" ? "name" | "last_updated" | "size" : "name";
    ascending?: boolean;
};

async function getPage<T extends "files" | "subfolders", R = Map<string, T extends "files" ? ClientFileHandle : ClientFolderHandle>>(
    path: string[] | string,
    type: T,
    page: number,
    sort?: Sort<T>
): Promise<DataErrorFields<R, ListingError>> {
    path = typeof path === "string" ? path : convertRouteToPath(path);
    const packet = new ListRequestPacket({ path, page, type, sort_by: sort?.field, ascending_sort: sort?.ascending });
    const com = await getOrCreateCommunicator();

    if (type === "files") {
        const res = await com.sendPacketAndReply_new(packet, ListFilesPacket);
        if (!res.packet) {
            return { data: null, error: { message: res.error, can_retry: true } };
        }
        const { files, success } = res.packet.getData();
        if (!success) {
            return { data: null, error: { message: "Failed to load files on the page", can_retry: true } };
        }
        const map = createMapFromNamedArray<ClientFileHandle>(files as ClientFileHandle[]);
        return { data: map as R, error: null };
    } else {
        const res = await com.sendPacketAndReply_new(packet, ListFoldersPacket);
        if (!res.packet) {
            return { data: null, error: { message: res.error, can_retry: true } };
        }
        const { folders, success } = res.packet.getData();
        if (!success) {
            return { data: null, error: { message: "Failed to load folders on the page", can_retry: true } };
        }
        const map = createMapFromNamedArray<ClientFolderHandle>(folders as ClientFolderHandle[]);
        return { data: map as R, error: null };
    }
}
