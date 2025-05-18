import { getAuthentication, resolvePromise } from "./authentication";
import { activeListingEntry, getListingForDirectory, updateActiveListingEntry } from "./listing";

export const globals = {
    authentication: {
        get: getAuthentication,
        resolvePromise
    },
    listing: {
        fetch: getListingForDirectory,
        active: activeListingEntry,
        writeActive: updateActiveListingEntry
    }
} as const;
