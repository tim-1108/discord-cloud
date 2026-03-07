import type { DataErrorFields } from "../../common/index.js";
import { patterns } from "../../common/patterns.js";
import type { UserHandle } from "../../common/supabase.js";
import { Authentication } from "../authentication.js";
import { supabase } from "./core.js";
import { parsePostgrestResponse } from "./helper.js";

export const Database$Users = {
    get: getUser_Database,
    getByName: getUserByName_Database,
    create: createUser,
    updatePassword: updateUserPassword,
    count: getUserCount,
    findByName
} as const;

function getUser_Database(id: number) {
    return parsePostgrestResponse<UserHandle>(supabase.from("users").select("*").eq("id", id).single());
}

function getUserByName_Database(username: string) {
    return parsePostgrestResponse<UserHandle>(supabase.from("users").select("*").eq("username", username).single());
}

/**
 * Finds users that have the query anywhere within their name.
 * Limited to at most 100 values.
 */
async function findByName(query: string): Promise<DataErrorFields<UserHandle[]>> {
    if (!patterns.username.test(query)) {
        throw new TypeError("Invalid username query passed into findByName()");
    }
    const response = await supabase.from("users").select().like("username", `%${query}%`).limit(100);
    if (response.error !== null) {
        return { data: null, error: response.error.message };
    }
    return { data: response.data, error: null };
}

async function createUser(username: string, password: string, administrator?: boolean): Promise<UserHandle | null> {
    const $password = Authentication.password.generate(password);
    const response = await supabase
        .from("users")
        .insert({ username, password: $password.hash, salt: $password.salt, administrator: administrator ?? false })
        .select("*")
        .single();
    if (response.error !== null) {
        // TODO: Check whether the error which occured means a user with that same name already exists
        return null;
    }
    return response.data;
}

async function updateUserPassword({ id, password, salt }: Pick<UserHandle, "id" | "password" | "salt">) {
    return parsePostgrestResponse<UserHandle>(supabase.from("users").update({ password, salt }).eq("id", id).select("*").single());
}

async function getUserCount(): Promise<DataErrorFields<number>> {
    const { data, error } = await supabase.from("users").select("count()", { count: "exact" }).single();
    if (!data) {
        return { data: null, error: error.details };
    }
    return { data: data.count, error: null };
}
