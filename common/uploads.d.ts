import type { PrefixedUUIDS, UUID } from "./index.js";

export interface UploadMetadata {
    upload_id: UUID;
    /**
     * `null` indicates that this upload is happening
     * within the root folder and it thus cannot be locked.
     */
    folder_lock_id: PrefixedUUIDS["folder-lock"] | null;
    chunk_size: number;
    is_public: boolean;
    client: UUID;
    /**
     * This field has the prefix `desired` to indicate that
     * this is not the final name, only what the user wished for.
     */
    desired_name: string;
    path: string;
    size: number;
    /**
     * Specified within the upload start request. Will cause
     * the system to attempt to overwrite any file with the
     * given name and will never ask the user whether the file
     * should actually be overwritten.
     */
    do_overwrite?: boolean;
}
