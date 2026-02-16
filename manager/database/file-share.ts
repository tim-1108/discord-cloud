import type { FileShareHandle } from "../../common/supabase.js";
import { supabase } from "./core.js";
import { parsePostgrestResponse } from "./helper.js";

export function getFileShare(user: number, file: number) {
    return parsePostgrestResponse<FileShareHandle>(supabase.from("file-share").select().eq("user", user).eq("file", file).single());
}

export function deleteFileShare(user: number, file: number) {
    return parsePostgrestResponse<FileShareHandle>(supabase.from("file-share").delete().eq("user", user).eq("file", file).select().single());
}

export function updateFileShare(user: number, file: number, canWrite: boolean) {
    return parsePostgrestResponse<FileShareHandle>(
        supabase.from("file-share").update({ can_write: canWrite }).eq("user", user).eq("file", file).select().single()
    );
}

export async function insertFileShare(user: number, file: number, canWrite: boolean) {
    const existingShare = await getFileShare(user, file);
    if (existingShare !== null) {
        return updateFileShare(user, file, canWrite);
    }
    return parsePostgrestResponse<FileShareHandle>(supabase.from("file-share").insert({ user, file, can_write: canWrite }).select().single());
}

export function deleteAllFileShares(file: number) {
    return parsePostgrestResponse<FileShareHandle[]>(supabase.from("file-share").delete().eq("file", file).select());
}
