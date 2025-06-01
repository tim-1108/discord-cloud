import type { UUID } from "./index.js";

export interface UploadMetadataClientProvided {
    client: UUID;
    name: string;
    path: string;
    size: number;
}

export interface UploadMetadata extends UploadMetadataClientProvided {
    upload_id: UUID;
    overwrite_target: number | null;
    overwrite_user_id: number | null;
    chunk_size: number;
    is_public: boolean;
}
