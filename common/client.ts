import { patterns } from "./patterns.js";
import type { FileShareHandle, FolderHandle } from "./supabase.js";

export type ClientFileHandle = {
    id: number;
    name: string;
    type: string;
    has_thumbnail: boolean;
    ownership: FileOwnershipStatus;
    created_at: string | null;
    updated_at: string | null;
    size: number;
    /**
     * Not passed on listings, only when the file is modified or added,
     * so just on `FileModifyPacket`s.
     */
    thumbnail_url?: string;
};

export type ClientFileOwnership = "owned" | "shared" | "public" | "restricted";
export type FileOwnershipStatus = { status: Exclude<ClientFileOwnership, "shared"> } | { status: "shared"; share: FileShareHandle };

export type ClientFolderHandle = FolderHandle;
export type FileModifyAction = "add" | "delete" | "modify";

export type FolderModifyAction = "add" | "delete" | "rename" | "move";

export const ClientFileSchema = {
    type: "record",
    required: true,
    items: {
        id: { type: "number", required: true },
        name: { type: "string", required: true },
        type: { type: "string", required: true },
        has_thumbnail: { type: "boolean", required: true },
        ownership: {
            type: "conditional_record",
            required: true,
            options: [
                {
                    status: { type: "string", required: true, options: ["shared"] },
                    share: {
                        type: "record",
                        required: true,
                        items: {
                            can_write: { type: "boolean", required: true },
                            file: { type: "number", required: true },
                            shared_at: { type: "string", required: true },
                            user: { type: "number", required: true }
                        }
                    }
                },
                {
                    status: { type: "string", required: true, options: ["owned", "public", "restricted"] }
                }
            ]
        },
        created_at: { type: "string", required: true },
        updated_at: { type: "string", required: true },
        size: { type: "number", required: true },
        thumbnail_url: { type: "string", required: false }
    }
} as const;

export const FolderHandleSchema = {
    type: "record",
    required: true,
    items: {
        id: { type: "number", required: true, min: 0 },
        name: { type: "string", required: true, pattern: patterns.fileName },
        parent_folder: { type: "number", required: true, allow_null: true, min: 0 }
    }
} as const;
