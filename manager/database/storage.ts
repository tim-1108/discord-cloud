import { logDebug, logError, logWarn } from "../../common/logging";
import { parseFileSize } from "../../common/useless";
import { supabase } from "./core";
import type { Bucket } from "@supabase/storage-js";

export async function uploadThumbnailToStorage(id: number, data: Buffer) {
    const BUCKET_NAME = "thumbnails";
    const MAX_UPLOAD_SIZE = 2 * 1024; // the target image should not be larger than 2kb
    if (data.length > MAX_UPLOAD_SIZE) {
        logWarn("Thumbnail for file", id, "is larger than the allowed size");
        return false;
    }
    const bucket = await getOrCreateBucket(BUCKET_NAME);
    if (bucket === null) return false;

    const response = await supabase.storage.from(BUCKET_NAME).upload(idToFilePath(id), data, { contentType: "image/jpeg" });
    if (response.error !== null) {
        logError("Failed to upload thumbnail for", id, response.error);
        return false;
    }
    logDebug("Uploaded thumbnail for file", id, "with size", parseFileSize(data.length));
    return true;
}

const idToFilePath = (id: number) => id.toString(10) + ".jpg";

export async function removeThumbnailFromStorage(id: number) {
    const BUCKET_NAME = "thumbnails";
    const bucket = await getOrCreateBucket(BUCKET_NAME);
    if (bucket === null) return false;

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
