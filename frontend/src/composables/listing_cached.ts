import type { DataErrorFields } from "../../../common";
import type { ClientFileHandle, ClientFolderHandle } from "../../../common/client";
import { FolderStatusRequestPacket } from "../../../common/packet/c2s/FolderStatusRequestPacket";
import { ListRequestPacket } from "../../../common/packet/c2s/ListRequestPacket";
import type { C2SPacket } from "../../../common/packet/C2SPacket";
import type { Packet } from "../../../common/packet/Packet";
import type { FileModifyPacket } from "../../../common/packet/s2c/FileModifyPacket";
import { FolderStatusPacket } from "../../../common/packet/s2c/FolderStatusPacket";
import { ListFilesPacket } from "../../../common/packet/s2c/ListFilesPacket";
import { ListFoldersPacket } from "../../../common/packet/s2c/ListFoldersPacket";
import type { FolderHandle } from "../../../common/supabase";
import { createMapFromNamedArray } from "../../../common/useless";
import { getOrCreateCommunicator } from "./authentication";
import { convertPathToRoute, convertRouteToPath } from "./path";

export const CachedListing = {};

function createEmptyStruct<T extends boolean = false>(
    name: T extends true ? null : string,
    parent: T extends true ? null : ListingStruct | RootListingStruct,
    isRoot?: T
): T extends true ? RootListingStruct : ListingStruct {
    const base: RootListingStruct = {
        subfolder_count: 0,
        file_count: 0,
        page_size: 0,
        subfolders: new Map(),
        files: new Map(),
        subfolder_listings: new Map()
    };
    if (isRoot) {
        return base as any;
    }
    return { ...base, name, parent } as any;
}

const cache = createEmptyStruct(null, null, true);

type ListingStruct = {
    name: string;
    subfolder_count: number;
    file_count: number;
    page_size: number;
    subfolders: Map<number, Map<string, ClientFolderHandle>>;
    files: Map<number, Map<string, ClientFileHandle>>;
    subfolder_listings: Map<string, ListingStruct>;
    parent: ListingStruct;
};
type RootListingStruct = Omit<ListingStruct, "parent" | "name">;

function getStructForRoute<C extends boolean = false>(
    route: string[],
    doNotCreate?: C
): RootListingStruct | ListingStruct | (C extends true ? null : never) {
    let parent = cache;
    for (let i = 0; i < route.length; i++) {
        const name = route[i];
        let struct = parent.subfolder_listings.get(name);
        if (!struct) {
            if (doNotCreate) {
                return null as any;
            }
            struct = createEmptyStruct(name, parent);
            parent.subfolder_listings.set(name, struct);
        }
        parent = struct;
    }
    return parent;
}

type ListingError = {
    message: string;
    can_retry: boolean;
    can_create: boolean;
};

async function initListing(route: string[] | string): Promise<DataErrorFields<true>> {
    route = typeof route === "string" ? convertPathToRoute(route) : route;
    const hit = getStructForRoute(route, true);
    if (hit) {
        // Already init'd, were good to go
        return { error: null, data: true };
    }
    const com = await getOrCreateCommunicator();
    const path = convertRouteToPath(route);
    const res = await com.sendPacketAndReply_new(new FolderStatusRequestPacket({ path }), FolderStatusPacket);
    if (!res.packet) {
        return { error: "The server did not respond in time", data: null };
    }
    const { exists, subfolder_count, file_count, page_size } = res.packet.getData();
    if (!exists) {
        return { error: "The folder does not exist", data: null };
    }
    const struct = getStructForRoute(route);
    struct.subfolder_count = subfolder_count;
    struct.file_count = file_count;
    struct.page_size = page_size;
    return { error: null, data: true };
}

function handleFileModify(packet: FileModifyPacket) {
    const { path, action, handle } = packet.getData();
}

/**
 * This function does not use caching. A caching implementation might produce issues:
 * - where should files that are added using the file-modify packet be placed?
 * -
 */
async function getListingPage<T extends "files" | "subfolders", R = Map<string, T extends "files" ? ClientFileHandle : ClientFolderHandle>>(
    route: string[],
    type: T,
    page: number
): Promise<DataErrorFields<R>> {
    // We need to create the entry anyhow, whether it exists currently or not.
    const hit = getStructForRoute(route, false);
    if (hit) {
        const map = type === "files" ? hit.files : hit.subfolders;
        const data = map.get(page) as R | null;
        if (data) {
            return { data, error: null };
        }
    }
    const path = typeof route === "string" ? route : convertRouteToPath(route);
    const packet = new ListRequestPacket({ path, page, type });
    const com = await getOrCreateCommunicator();

    if (type === "files") {
        const res = await com.sendPacketAndReply_new(packet, ListFilesPacket);
        if (!res.packet) {
            return { data: null, error: res.error };
        }
        const { files, success } = res.packet.getData();
        if (!success) {
            return { data: null, error: "Failed to load files on the page" };
        }
        const map = createMapFromNamedArray<ClientFileHandle>(files as ClientFileHandle[]);
        hit.files.set(page, map);
        return { data: map as R, error: null };
    } else {
        const res = await com.sendPacketAndReply_new(packet, ListFoldersPacket);
        if (!res.packet) {
            return { data: null, error: res.error };
        }
        const { folders, success } = res.packet.getData();
        if (!success) {
            return { data: null, error: "Failed to load folders on this page" };
        }
        const map = createMapFromNamedArray<ClientFolderHandle>(folders as ClientFolderHandle[]);
        hit.subfolders.set(page, map);
        return { data: map as R, error: null };
    }
}
