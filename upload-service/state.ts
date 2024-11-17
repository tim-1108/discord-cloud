import type { UploadMetadata } from "../common/uploads";
import { generateChunkSizes } from "./file-helper.ts";

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
}
type DataMap = Map<
    keyof Data, // Keys are the keys of the Data type
    Data[keyof Data] // Values are the corresponding value types from the Data type
>;
const data: DataMap = new Map([["busy", false]]);

export function setPendingUpload(metadata: UploadMetadata) {
    if (isBusy()) return false;
    const chunks = generateChunkSizes(metadata.size);
    // TODO: allow empty files to be uploaded
    if (!chunks.length) return false;

    markBusy();
    data.set("upload", {
        metadata,
        chunks,
        completed_chunks: new Map()
    });

    console.log("Now listening for upload");

    return true;
}
