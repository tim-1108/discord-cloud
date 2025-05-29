import type { FolderHandle } from "./supabase.js";

export type ClientFileHandle = {
    id: number;
    name: string;
    type: string;
    has_thumbnail: boolean;
    ownership: OwnershipStatus;
    created_at: string | null;
    updated_at: string | null;
    size: number;
};

export type ClientFileOwnership = "owned" | "shared" | "public" | "restricted";
export type FileOwnershipStatus = { status: Exclude<ClientFileOwnership, "shared"> } | { status: "shared"; share: FileShareHandle };

export type ClientFolderHandle = FolderHandle;
