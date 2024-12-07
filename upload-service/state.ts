import type { UploadMetadata } from "../common/uploads";
import { startWatchingTimeout } from "./index.ts";
import { getEnvironmentVariables } from "../common/environment.ts";

export function isBusy() {
    return data.get("busy") === true;
}
function markBusy() {
    data.set("busy", true);
}
function markNotBusy() {
    data.set("busy", false);
}
export function getUploadState() {
    return data.get("upload") as UploadData | undefined;
}
export function clearUploadState() {
    markNotBusy();
    data.delete("upload");
}

type Data = {
    busy: boolean;
    upload: UploadData;
};
export interface UploadData {
    metadata: UploadMetadata;
    chunks: number[];
    /**
     * Discord message IDs mapped to the indices of chunks
     */
    completed_chunks: Map<number, string>;
    /**
     * The chunk indices currently processing/uploading
     */
    processing: Set<number>;
    /**
     * The mime type of the file, determined by the first buffer
     */
    type: string;
    /**
     * The hashes of all the different buffers.
     *
     * As a string, they are concatenated at the end to then be hashed again!
     */
    hashes: string[];
    should_encrypt: boolean;
}
type DataMap = Map<
    keyof Data, // Keys are the keys of the Data type
    Data[keyof Data] // Values are the corresponding value types from the Data type
>;
const data: DataMap = new Map([["busy", false]]);

export function setPendingUpload(metadata: UploadMetadata, chunks: number[]) {
    if (isBusy()) return false;
    // TODO: allow empty files to be uploaded
    if (!chunks.length) return false;

    markBusy();
    data.set("upload", {
        metadata,
        chunks,
        completed_chunks: new Map(),
        processing: new Set(),
        type: "application/octet-stream",
        hashes: new Array<string>(chunks.length),
        should_encrypt: getEnvironmentVariables("upload-service").ENCRYPTION === "1"
    });

    console.log("[Upload] Started!", data);
    void startWatchingTimeout(chunks);

    return true;
}
