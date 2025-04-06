import { communicator } from "@/main";
import { convertPathToRoute, convertRouteToPath, useCurrentRoute } from "./path";
import { ListRequestPacket } from "../../../common/packet/c2s/ListRequestPacket";
import { ListPacket } from "../../../common/packet/s2c/ListPacket";
import type { PartialDatabaseFileRow, PartialDatabaseFolderRow } from "../../../manager/database/core";
import { patterns } from "../../../common/patterns";
import { ref } from "vue";

type Listing = { files: PartialDatabaseFileRow[]; folders: PartialDatabaseFolderRow[] };
type ListingCacheItem = {
    /**
     * A flag indicating whether the content in `files` and `folders` is
     * accuratly cached. If `false`, the data has to be re-fetched and then stored.
     *
     * Useful when only the data in this very folder should be invalidated, but
     * the data in all subfolders should stay untouched.
     */
    cached: boolean;
    files: PartialDatabaseFileRow[];
    /**
     * Does not store any actual subfolder data, only metadata about subfolders contained herein
     */
    folders: PartialDatabaseFolderRow[];
    /**
     * This is a recursive storage, always going deeper and deeper.
     */
    subfolder_cache: Map<string, ListingCacheItem>;
};
const cache: { root: ListingCacheItem | null } = { root: null };

export const currentFolderListing = ref<Listing | "loading" | "error">("loading");
export function useCurrentFolderListing() {
    return currentFolderListing.value;
}

async function getListingForDirectory(route: string[]) {
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

    const reply = await communicator.sendPacketAndReply(new ListRequestPacket({ path }), ListPacket);
    if (!reply) {
        return null;
    }
    const { files, folders } = reply.getData();
    // The validator functions inside the ListPacket class assure us that these arrays do not contain undefined
    const returnValue = {
        files: sortArrayByName(files as PartialDatabaseFileRow[]),
        folders: sortArrayByName(folders as PartialDatabaseFolderRow[])
    };
    writeToCache(route, returnValue);
    return returnValue;
}

function sortArrayByName<T extends { name: string }>(list: T[]): T[] {
    return list.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * A callee of this function is expected to set the {@link currentFolderListing} state to either
 * the return value of this function or `error` themselves.
 * @returns The listing data for the current directory, if successful
 */
export async function getListingForCurrentDirectory(): Promise<Listing | null> {
    const route = useCurrentRoute();
    currentFolderListing.value = "loading";
    return getListingForDirectory(route.value);
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
