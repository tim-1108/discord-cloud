import type { UUID } from "./index";

export interface UploadMetadataClientProvided {
    client: UUID;
    name: string;
    path: string;
    size: number;
}

export interface UploadMetadata extends UploadMetadataClientProvided {
    upload_id: UUID;
}
