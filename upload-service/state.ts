import type { UploadMetadata } from "../common/uploads";

export function isBusy() {
    return data.get("busy") === true;
}
function markBusy() {
    data.set("busy", true);
}
function markNotBusy() {
    data.set("busy", false);
}
export function getCurrentUpload() {
    return data.get("upload") as UploadData | undefined;
}
export function endCurrentUpload() {
    console.info("We have finished the upload");
    markNotBusy();
    data.delete("upload");
}

type Data = {
    busy: boolean;
    upload: UploadData;
};
interface UploadData {
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

    console.log(chunks, metadata);

    markBusy();
    data.set("upload", {
        metadata,
        chunks,
        completed_chunks: new Map(),
        processing: new Set()
    });

    console.log("Now listening for upload");

    return true;
}
