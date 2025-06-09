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
    thumbnail_url?: string;
};

export type ClientFileOwnership = "owned" | "shared" | "public" | "restricted";
export type FileOwnershipStatus = { status: Exclude<ClientFileOwnership, "shared"> } | { status: "shared"; share: FileShareHandle };

export type ClientFolderHandle = FolderHandle;
export type FileModifyAction = "add" | "delete" | "modify";

export const ClientFileSchema = {
    type: "record",
    required: true,
    items: {
        id: { type: "number", required: true },
        name: { type: "string", required: true },
        type: { type: "string", required: true },
        has_thumbnail: { type: "boolean", required: true },
        ownership: {
            type: "record",
            required: true,
            items: {
                status: { type: "string", required: true },
                share: {
                    type: "record",
                    required: false,
                    items: {
                        can_write: { type: "boolean", required: true },
                        file: { type: "number", required: true },
                        shared_at: { type: "string", required: true },
                        user: { type: "number", required: true }
                    }
                }
            }
        },
        created_at: { type: "string" },
        updated_at: { type: "string" },
        size: { type: "number", required: true },
        thumbnail_url: { type: "string", required: false }
    }
} as const;
