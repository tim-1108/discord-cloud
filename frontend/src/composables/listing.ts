import { communicator } from "@/main";
import { areRoutesIdentical, convertPathToRoute, convertRouteToPath, useCurrentRoute } from "./path";
import { ListRequestPacket } from "../../../common/packet/c2s/ListRequestPacket";
import { ListPacket } from "../../../common/packet/s2c/ListPacket";
import { patterns } from "../../../common/patterns";
import { nextTick, ref } from "vue";
import type { FolderHandle } from "../../../common/supabase";
import type { ClientFileHandle, FileModifyAction } from "../../../common/client";
import type { FileModifyPacket } from "../../../common/packet/s2c/FileModifyPacket";
import { logWarn } from "../../../common/logging";
import { globals } from "./globals";
import { Thumbnails } from "./thumbnail";

export type Listing = { files: ClientFileHandle[]; folders: FolderHandle[] };
type ListingCacheItem = {
    /**
     * A flag indicating whether the content in `files` and `folders` is
     * accuratly cached. If `false`, the data has to be re-fetched and then stored.
     *
     * Useful when only the data in this very folder should be invalidated, but
     * the data in all subfolders should stay untouched.
     */
    cached: boolean;
    files: ClientFileHandle[];
    /**
     * Does not store any actual subfolder data, only metadata about subfolders contained herein
     */
    folders: FolderHandle[];
    /**
     * This is a recursive storage, always going deeper and deeper.
     */
    subfolder_cache: Map<string, ListingCacheItem>;
};
const cache: { root: ListingCacheItem | null } = { root: null };

export const activeListingEntry = ref<Listing | ListingError | null>(null);
export function updateActiveListingEntry(val: Listing | ListingError | null) {
    // Should cause Vue refs that are not { deep: true } to refresh too
    // (If only array contents change, the array itself might not count as updated)
    // TODO: Is it necessary to update to null?
    activeListingEntry.value = null;
    // This causes the listing container to unmount whenever switching paths,
    // even when cached. Makes sure that i.e. the thumbnail containers are
    // unloaded properly. If not, they would keep/inherit from the previous path.
    nextTick(() => {
        activeListingEntry.value = val;
    });
}

export interface ListingError {
    code: string;
    can_retry: boolean;
    can_create_folder?: boolean;
}

export function isListingError(data: any): data is ListingError {
    return typeof data.code === "string";
}

export async function getListingForDirectory(route: string[]): Promise<Listing | ListingError> {
    const path = convertRouteToPath(route);

    // The only places where user input should be admitted directly into a path,
    // it ought to be validated properly and at that place. If this incorrect content
    // managed to get into the useCurrentRoute ref, something is amiss.
    //
    // However, there is a watch (vue) on the route variable and this should
    // cause it to correct or default back to another value.
    // We'll just let it do its thing.
    if (!patterns.stringifiedPath.test(path)) throw new Error("Received invalid path for listing");

    const cacheHit = getCachedRoute(route);
    if (cacheHit) return cacheHit;

    globals.listing.writeActive(null);

    const reply = await communicator.sendPacketAndReply(new ListRequestPacket({ path }), ListPacket, 60_000);
    if (!reply) {
        return { code: "The server did not respond in time", can_retry: true };
    }
    const { files, folders, success } = reply.getData();
    if (!success) {
        return { code: "This folder does not exist", can_retry: false, can_create_folder: true };
    }
    // The validator functions inside the ListPacket class assure us that these arrays do not contain undefined
    const returnValue = {
        files: sortArrayByName(files as ClientFileHandle[]),
        folders: sortArrayByName(folders as FolderHandle[])
    };
    writeToCache(route, returnValue);
    return returnValue;
}

function sortArrayByName<T extends { name: string }>(list: T[]): T[] {
    return list.sort((a, b) => a.name.localeCompare(b.name));
}

function extractFilesAndFolders(input: ListingCacheItem) {
    return { files: input.files, folders: input.folders };
}

function writeToCache(route: string[], listing: Listing): void {
    /**
     * Used to insert a empty item if a subfolder of this is cached,
     * but this one higher in the tree is not yet.
     */
    const createEmptyCache = () => ({ cached: false, files: [], folders: [], subfolder_cache: new Map() });
    if (!cache.root) {
        if (!route.length) {
            cache.root = { ...listing, cached: true, subfolder_cache: new Map() };
            return;
        }
        cache.root = createEmptyCache();
    }

    let parent = cache.root;
    for (let i = 0; i < route.length; i++) {
        const name = route[i];
        // Like this, we make sure that we can navigate down the tree and always create empty entries along the way
        const entry = parent.subfolder_cache.get(name) ?? parent.subfolder_cache.set(name, createEmptyCache()).get(name)!;
        if (i < route.length - 1) {
            parent = entry;
            continue;
        }

        entry.cached = true;
        entry.files = listing.files;
        entry.folders = listing.folders;
    }
}

function getCachedRoute(route: string[]): Listing | null {
    if (!route.length) {
        return cache.root !== null && cache.root.cached ? extractFilesAndFolders(cache.root) : null;
    }

    if (!cache.root) return null;

    const parent = getParentOfLastRouteItem(route);
    if (!parent) return null;

    const nameOfFolder = route[route.length - 1];
    const child = parent.subfolder_cache.get(nameOfFolder);
    if (!child || !child.cached) return null;
    return extractFilesAndFolders(child);
}

/**
 * Useful when wanting to delete the entry out of the
 * `subfolder_cache` map inside the parent.
 */
function getParentOfLastRouteItem(route: string[]): ListingCacheItem | null {
    if (!cache.root) return null;
    let parent = cache.root;

    // We navigate to the second to last entry
    // Thus, the parent in this context is the folder right
    // above that one we wish to delete/de-cache
    for (let i = 0; i < route.length - 1; i++) {
        const name = route[i];
        const child = parent.subfolder_cache.get(name);
        if (!child) return null;
        parent = child as ListingCacheItem;
    }
    return parent;
}

export function invalidateListingCache(pathOrRoute: string | string[], allSubfolders?: boolean) {
    const route = typeof pathOrRoute === "string" ? convertPathToRoute(pathOrRoute) : pathOrRoute;
    let parent = cache.root;

    if (!parent) {
        return true;
    }

    if (!route.length) {
        if (allSubfolders) {
            cache.root = null;
            return true;
        }
        parent.cached = false;
        parent.files = [];
        parent.folders = [];
        return true;
    }

    parent = getParentOfLastRouteItem(route);
    // Technically yes, it is gone - but well, it was never there to begin with
    if (!parent) return false;

    const nameOfFolder = route[route.length - 1];

    if (allSubfolders) {
        return parent.subfolder_cache.delete(nameOfFolder);
    }

    const item = parent.subfolder_cache.get(nameOfFolder);
    if (!item) return false;
    item.cached = false;
    item.files = [];
    item.folders = [];
    return true;
}

export function listingFileModify(packet: FileModifyPacket) {
    const { action, path, handle } = packet.getData();
    const route = convertPathToRoute(path);
    const hit = getCachedRoute(route);
    // If the route is not even cached, there is no point in storing
    // the changes. In fact, it would even be contraproductive.
    if (!hit) {
        return;
    }

    // If so, we will have to reload the currently rendered route
    const isAtRoute = areRoutesIdentical(route, useCurrentRoute().value);

    const $action = action as FileModifyAction;

    if ($action === "add") {
        hit.files.push(handle as ClientFileHandle);
    } else {
        const index = hit.files.findIndex(({ id }) => id === handle.id);
        if (index === -1) {
            // This should not be able to happen as only actually cached
            // routes can get to this point - thus, everything within
            // should also be cached.
            logWarn("A file modify for a cached route was not cached", handle);
            return;
        }
        if ($action === "delete") {
            hit.files.splice(index, 1);
            // We place this after the check whether the file handle itself is cached
            // as we can assume that if the file itself is not cached, the thumbnail
            // cannot be cached either. (viewing the thumb required having seen the file)
            Thumbnails.invalidate(handle.id);
        } else {
            if (handle.thumbnail_url && handle.thumbnail_url === hit.files[index].thumbnail_url) {
                Thumbnails.overwrite(handle.id, handle.thumbnail_url);
            }
            hit.files[index] = handle as ClientFileHandle;
        }
    }

    if (isAtRoute) {
        updateActiveListingEntry(hit);
    }
}
