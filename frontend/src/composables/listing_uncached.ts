import { computed, nextTick, ref, toRaw } from "vue";
import type { DataErrorFields } from "../../../common";
import type { ClientFileHandle, ClientFolderHandle, FileModifyAction, FolderModifyAction } from "../../../common/client";
import { FolderSizeRequestPacket } from "../../../common/packet/c2s/FolderSizeRequestPacket";
import { FolderStatusRequestPacket } from "../../../common/packet/c2s/FolderStatusRequestPacket";
import { ListRequestPacket } from "../../../common/packet/c2s/ListRequestPacket";
import { FolderSizePacket } from "../../../common/packet/s2c/FolderSizePacket";
import { FolderStatusPacket } from "../../../common/packet/s2c/FolderStatusPacket";
import { ListFilesPacket } from "../../../common/packet/s2c/ListFilesPacket";
import { ListFoldersPacket } from "../../../common/packet/s2c/ListFoldersPacket";
import { getOrCreateCommunicator } from "./authentication";
import {
    areRoutesIdentical,
    convertPathToRoute,
    convertRouteToPath,
    distanceOfRouteWithinOtherRoute,
    getLastFolderName,
    getParentFolderRoute,
    navigateToAbsoluteRoute,
    navigateToParentFolder,
    useListingRoute
} from "./path";
import type { FileModifyPacket } from "../../../common/packet/s2c/FileModifyPacket";
import type { FolderModifyPacket } from "../../../common/packet/s2c/FolderModifyPacket";
import { logWarn } from "../../../common/logging";

export interface ListingMetadata {
    subfolder_count: number;
    file_count: number;
    page_size: number;
    folder_id: number | null;
    /**
     * Used to compare the inputted path to. If the path in here does
     * not match the current path, we do not render the ListingWrapper.
     */
    path: string;
}

export type ListingError = {
    message: string;
    can_retry?: boolean;
    can_create?: boolean;
};

export const UncachedListing = {
    init,
    getFilesPage,
    getSubfolderPage,
    getSizes,
    register,
    unregister,
    modify: {
        file: modifyFile,
        folder: modifyFolder
    }
};

// === registration for current metadata ===
// All fetching functions in this file are stateless, they don't
// remember nor store anything. That is the resposiblity of the
// component for the current route. But to allow other systems to
// read the metadata of the current route, they can use this registration.
// When the route changes and the component is unmounted, the unregister()
// function is called.

type Registration = {
    metadata: ListingMetadata;
    /**
     * Called whenever a file within this registered folder is added, modified in
     * any way or deleted.
     */
    fileModifyListener: (handle: ClientFileHandle, action: FileModifyAction) => void;
    /**
     * This callback is called whenever a child folder is updated in any way (or added).
     * If any parent folder or this folder's name is updated, the user gets booted
     * from the folder to the new name. Currently, this will cause their UI to be reloaded.
     * Maybe that can be addressed, but unlikely.
     */
    folderModifyListener: (handle: ClientFolderHandle, action: FolderModifyAction, renameOrigin?: string, parentFolderOrigin?: number | null) => void;
};
const registration = ref<Registration | null>(null);
const listingMetadataRef = computed(() => (registration.value ? registration.value.metadata : null));
export const useListingMetadata = () => listingMetadataRef;
function register(
    metadata: ListingMetadata,
    fileModifyListener: (handle: ClientFileHandle, action: FileModifyAction) => void,
    folderModifyListener: (handle: ClientFolderHandle, action: FolderModifyAction) => void
): void {
    if (registration.value) {
        throw new Error("Registration is already defined, currently " + registration.value.metadata.path);
    }
    registration.value = { metadata, fileModifyListener, folderModifyListener };
}

function unregister() {
    if (!registration.value) {
        throw new ReferenceError("No registration defined when attempting to unregister");
    }
    registration.value = null;
}

// === modify handlers ===

function modifyFile(packet: FileModifyPacket) {
    const { handle, action, path } = packet.getData();

    // If we are not at this path, we can feel free to ignore the packet.
    if (!registration.value || registration.value.metadata.path !== path) return;
    registration.value.fileModifyListener(handle, action);
}

function modifyFolder(packet: FolderModifyPacket) {
    const { handle, action, path, rename_origin: rename_orgin, parent_folder_origin } = packet.getData();

    // This value changes when using any of the navigation functions!
    const ref = useListingRoute();
    const activeRoute = toRaw(ref.value);
    const targetRoute = convertPathToRoute(path);
    const aLength = activeRoute.length;
    const tLength = targetRoute.length;
    const tParent = getParentFolderRoute(targetRoute);
    const aParent = getParentFolderRoute(activeRoute);

    const metadata = useListingMetadata();
    // Folders that are nested too deep are never of any interest to us
    if (tLength > aLength + 1) return;

    if (action === "move") {
        logWarn("Received a folder move action. This is not yet implemented.");
        // Best method for now.
        navigateToAbsoluteRoute([]);
        return;
    }

    // This means that the updated folder is a direct decentant of
    // the active folder.
    //
    // If we are not registered, which is the case when the metadata
    // is not yet loaded or some error happend, we don't care about
    // updates to child folders as they still will load.
    if (metadata.value && handle.parent_folder === metadata.value.folder_id) {
        registration.value?.folderModifyListener(handle, action, rename_orgin, parent_folder_origin);
        return;
    }

    // It turned out that it wasn't a direct decendant despite the
    // correct length, so we'll just ignore it.
    if (tLength === aLength + 1) return;

    // NOTE: from here on, we don't use the registration. If the folder or a parent
    //       changes, that should happen independenly from whether or not the folder
    //       is loaded fully.
    //       Now we've established that the target is either above or just
    //       at our position in the file tree.

    if (action === "rename") {
        if (!rename_orgin) {
            logWarn("rename_origin not defined on rename folder action:", packet.getData());
            return;
        }

        // This is the same folder, just renamed.
        if (areRoutesIdentical(tParent, aParent) && rename_orgin === getLastFolderName(activeRoute)) {
            navigateToAbsoluteRoute(targetRoute);
            return;
        }

        // By pushing this, we can check whether the current directory
        // sits within the folder from before the rename.
        tParent.push(rename_orgin);
        const distance = distanceOfRouteWithinOtherRoute(tParent, activeRoute);
        if (distance <= 0) return;
        // For instance, if the parent folder got renamed, we'd only want to add the
        // slice where the current folder sits in. That would mean distance = 1
        const slice = activeRoute.slice(activeRoute.length - distance);
        navigateToAbsoluteRoute(targetRoute.concat(slice));
        return;
    }

    const distance = distanceOfRouteWithinOtherRoute(targetRoute, activeRoute);
    if (distance === -1) return;

    if (distance === 0) {
        // This is that the folder is getting created, something
        // the user may have requested. If so, we need to reload the page.
        // For now, we send them to the root and straigt back. Hacky, but
        if (action === "add") {
            navigateToAbsoluteRoute([]);
            nextTick(() => navigateToAbsoluteRoute(targetRoute));
        } else if (action === "delete") {
            navigateToParentFolder();
        }
        return;
    }

    // Now it has to be somewhere above in the tree.
    // If the folder is added, that still does not mean that
    // the current folder, somewhere beneath it, exists now.
    // So we just ignore that.
    if (action === "delete") {
        navigateToAbsoluteRoute(tParent);
    }
}

async function init(path: string[] | string): Promise<DataErrorFields<ListingMetadata, ListingError>> {
    path = typeof path === "string" ? path : convertRouteToPath(path);

    const com = await getOrCreateCommunicator();
    const res = await com.sendPacketAndReply_new(new FolderStatusRequestPacket({ path }), FolderStatusPacket);
    if (!res.packet) {
        return { error: { message: res.error }, data: null };
    }
    const { exists, subfolder_count, file_count, page_size, folder_id } = res.packet.getData();
    if (!exists) {
        return { error: { message: "The folder does not exist", can_create: true, can_retry: true }, data: null };
    }
    const data: ListingMetadata = {
        path,
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

export type Sort<T extends "files" | "subfolders"> = {
    field: T extends "files" ? SortingField : "name";
    ascending?: boolean;
};
export const SortingFieldOptions = [
    { field: "name", name: "Name" },
    { field: "updated_at", name: "Updated" },
    { field: "size", name: "Size" }
] as const;
export type SortingField = (typeof SortingFieldOptions)[number]["field"];

// TODO: Ecmascript guarantees us the return of values of a Map in insertion order
// when called via .values(). This might be needed to create a NamedMap with the
// file name as key. This would assure us when adding multiple pages that no item
// can appear multiple times.

async function getSubfolderPage(
    path: string[] | string,
    page: number,
    sort?: Sort<"subfolders">
): Promise<DataErrorFields<ClientFolderHandle[], ListingError>> {
    path = typeof path === "string" ? path : convertRouteToPath(path);
    const packet = new ListRequestPacket({ path, page, type: "subfolders", sort_by: sort?.field, ascending_sort: sort?.ascending });
    const com = await getOrCreateCommunicator();
    const res = await com.sendPacketAndReply_new(packet, ListFoldersPacket);
    if (!res.packet) {
        return { data: null, error: { message: res.error, can_retry: true } };
    }
    const { folders, success } = res.packet.getData();
    if (!success) {
        return { data: null, error: { message: "Failed to load folders on the page", can_retry: true } };
    }
    return { data: folders as ClientFolderHandle[], error: null };
}

async function getFilesPage(path: string[] | string, page: number, sort?: Sort<"files">): Promise<DataErrorFields<ClientFileHandle[], ListingError>> {
    path = typeof path === "string" ? path : convertRouteToPath(path);
    const packet = new ListRequestPacket({ path, page, type: "files", sort_by: sort?.field, ascending_sort: sort?.ascending });
    const com = await getOrCreateCommunicator();
    const res = await com.sendPacketAndReply_new(packet, ListFilesPacket);
    if (!res.packet) {
        return { data: null, error: { message: res.error, can_retry: true } };
    }
    const { files, success } = res.packet.getData();
    if (!success) {
        return { data: null, error: { message: "Failed to load files on the page", can_retry: true } };
    }
    return { data: files as ClientFileHandle[], error: null };
}
