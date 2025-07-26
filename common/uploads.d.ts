import type { UUID } from "./index.js";

export interface UploadMetadata {
    upload_id: UUID;
    overwrite_target: number | null;
    overwrite_user_id: number | null;
    chunk_size: number;
    is_public: boolean;
    client: UUID;
    name: string;
    path: string;
    size: number;
}
