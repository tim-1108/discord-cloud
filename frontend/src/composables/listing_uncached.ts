import type { DataErrorFields } from "../../../common";
import type { ClientFileHandle, ClientFolderHandle } from "../../../common/client";
import { FolderStatusRequestPacket } from "../../../common/packet/c2s/FolderStatusRequestPacket";
import { ListRequestPacket } from "../../../common/packet/c2s/ListRequestPacket";
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
}

export type ListingError = {
    message: string;
    can_retry?: boolean;
    can_create?: boolean;
};

export const UncachedListing = {
    init,
    getPage,
    modify: {}
};

async function init(path: string[] | string): Promise<DataErrorFields<ListingMetadata, ListingError>> {
    path = typeof path === "string" ? path : convertRouteToPath(path);

    const com = await getOrCreateCommunicator();
    const res = await com.sendPacketAndReply_new(new FolderStatusRequestPacket({ path }), FolderStatusPacket);
    if (!res.packet) {
        return { error: { message: res.error, can_retry: true }, data: null };
    }
    const { exists, subfolder_count, file_count, page_size } = res.packet.getData();
    if (!exists) {
        return { error: { message: "The folder does not exist", can_create: true }, data: null };
    }
    const data: ListingMetadata = {
        subfolder_count,
        file_count,
        page_size
    };
    return { error: null, data };
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
