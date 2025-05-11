import type { UUID } from "./index.js";

export interface UploadMetadataClientProvided {
    client: UUID;
    name: string;
    path: string;
    size: number;
}

export interface UploadMetadata extends UploadMetadataClientProvided {
    upload_id: UUID;
    is_overwriting_id: number | null;
}
