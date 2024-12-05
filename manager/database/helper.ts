import { type PostgrestBuilder, type PostgrestFilterBuilder } from "@supabase/postgrest-js";
import { type FolderOrRoot, ROOT_FOLDER_ID } from "./core";
// @ts-ignore This is an ugly import, sadly required
import { type GenericSchema } from "../../node_modules/@supabase/postgrest-js/src/types";

export async function parsePostgrestResponse<K, B extends PostgrestBuilder<K> = PostgrestBuilder<K>>(request: B) {
    const { data, error } = await request;
    return error ? null : data;
}

type Primitive = string | number | boolean | bigint;

export function nullOrTypeSelection<
    T extends Primitive,
    Schema extends GenericSchema,
    Row extends Record<string, unknown>,
    Result = any,
    RelationName = any,
    Relationships = any
>(builder: PostgrestFilterBuilder<Schema, Row, Result, RelationName, Relationships>, field: string & keyof Row, input: T | null) {
    return input === null ? builder.is(field, null) : builder.eq(field, input);
}

export function folderOrRootToDatabaseType(input: FolderOrRoot) {
    return input === ROOT_FOLDER_ID ? null : input;
}
