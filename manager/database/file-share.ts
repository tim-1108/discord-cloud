import type { FileShareHandle } from "../../common/supabase.js";
import { supabase } from "./core.js";
import { parsePostgrestResponse } from "./helper.js";

export function getFileShare(user: number, file: number) {
    return parsePostgrestResponse<FileShareHandle>(supabase.from("file-share").select().eq("user", user).eq("file", file).single());
}
