import { getEnvironmentVariables } from "../../common/environment.js";
import { logDebug, logError, logWarn } from "../../common/logging.js";
import { formatByteString } from "../../common/useless.js";
import { supabase } from "./core.js";
import type { Bucket } from "@supabase/storage-js";
import jwt from "jsonwebtoken";

const { USE_THUMBNAILS } = getEnvironmentVariables("supabase-storage", true);
const BUCKET_NAME = "thumbnails";

function isStorageEnabled(): boolean {
    return USE_THUMBNAILS === "1";
}

export async function uploadThumbnailToStorage(id: number, data: Buffer): Promise<boolean> {
    if (!isStorageEnabled()) return false;
    const bucket = await getOrCreateBucket(BUCKET_NAME);
    if (bucket === null) return false;

    const MAX_UPLOAD_SIZE = bucket.file_size_limit ?? Number.MAX_SAFE_INTEGER;
    if (data.length > MAX_UPLOAD_SIZE) {
        // There just will not be any thumbnail - easy as that.
        logWarn("Thumbnail for file", id, "is larger than the allowed size");
        return false;
    }

    const response = await supabase.storage.from(BUCKET_NAME).upload(idToFilePath(id), data, { contentType: "image/avif" });
    if (response.error !== null) {
        logError("Failed to upload thumbnail for", id, response.error);
        return false;
    }
    logDebug("Uploaded thumbnail for file", id, "with size", formatByteString(data.length));
    return true;
}

const idToFilePath = (id: number) => id.toString(10) + ".avif";

export async function deleteThumbnailFromStorage(id: number): Promise<boolean> {
    if (!isStorageEnabled()) return false;
    const bucket = await getOrCreateBucket(BUCKET_NAME);
    if (bucket === null) return false;

    thumbnailCache.delete(id);

    const response = await supabase.storage.from(BUCKET_NAME).remove([idToFilePath(id)]);
    // If an error occured, it is most likely due to the file not existing in the first place!
    return response.error === null;
}

async function getOrCreateBucket(id: string): Promise<Bucket | null> {
    const bucket = await supabase.storage.getBucket(id);
    if (!bucket.error) {
        return bucket.data;
    }
    const createdBucket = await supabase.storage.createBucket(id, { public: false });
    if (createdBucket.error) {
        logError("Failed to create storage bucket", id, createdBucket.error);
        return null;
    }
    return (await supabase.storage.getBucket(id)).data;
}

export async function getSignedLinkForThumbnail(id: number) {
    if (!isStorageEnabled()) return null;
    const A_DAY_MS = 24 * 60 * 60 * 1000;
    const AN_HOUR_SEC = 60_000;
    const hit = thumbnailCache.get(id);
    cached: if (hit) {
        // No catch block as the server is the only one writing to the cache
        const url = new URL(hit);
        const token = url.searchParams.get("token");
        if (!token) {
            // Should be impossible!
            thumbnailCache.delete(id);
            // wow! this syntax is actually great!
            break cached;
        }
        // We only care about the expiry timestamp, although there
        // is other data encoded within. Also, we will just assume
        // the data is correct, as it always comes from Supabase
        // directly (maybe this will crash at some point)
        const $token = jwt.decode(token) as { exp: number };

        const now = Math.floor(Date.now() / 1000);
        // If the link remains valid for less than an hour,
        // we will also just invalidate it to allow the user
        // a smooth browsing experience for a longer time.
        if (now > $token.exp - AN_HOUR_SEC) {
            thumbnailCache.delete(id);
            break cached;
        }
        return hit;
    }

    const response = await supabase.storage.from(BUCKET_NAME).createSignedUrl(idToFilePath(id), A_DAY_MS);
    if (response.error) {
        // TODO: parse what error? here, that may not be necessary
        return null;
    }
    const { signedUrl } = response.data;
    thumbnailCache.set(id, signedUrl);
    return signedUrl;
}
const thumbnailCache = new Map<number, string>();
