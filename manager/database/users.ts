import type { UserHandle } from "../../common/supabase.js";
import { Authentication } from "../authentication.js";
import { supabase } from "./core.js";
import { parsePostgrestResponse } from "./helper.js";

export function getUser_Database(id: number) {
    return parsePostgrestResponse<UserHandle>(supabase.from("users").select("*").eq("id", id).single());
}

export function getUserByName_Database(username: string) {
    return parsePostgrestResponse<UserHandle>(supabase.from("users").select("*").eq("username", username).single());
}

export async function createUser(username: string, password: string) {
    const $password = Authentication.password.generate(password);
    const response = await supabase.from("users").insert({ username, password: $password.hash, salt: $password.salt }).select("*").single();
    if (response.error !== null) {
        // TODO: Check whether the error which occured means a user with that same name already exists
        return null;
    }
    return response.data;
}

export async function updateUserPassword({ id, password, salt }: Pick<UserHandle, "id" | "password" | "salt">) {
    // TODO: should we log off all clients of this user?
    return parsePostgrestResponse<UserHandle>(supabase.from("users").update({ password, salt }).eq("id", id).select("*").single());
}
