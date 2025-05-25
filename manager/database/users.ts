import type { UserHandle } from "../../common/supabase.js";
import { supabase } from "./core.js";
import { parsePostgrestResponse } from "./helper.js";

export function getUserFromDatabase(id: number) {
    return parsePostgrestResponse<UserHandle>(supabase.from("users").select("*").eq("id", id).single());
}

export async function updateUserPassword(id: number, hash: string, salt: number) {}
