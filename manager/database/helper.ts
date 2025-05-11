import { type PostgrestBuilder, type PostgrestFilterBuilder } from "@supabase/postgrest-js";
import { type FolderOrRoot, ROOT_FOLDER_ID } from "./core.js";

export async function parsePostgrestResponse<K, B extends PostgrestBuilder<K> = PostgrestBuilder<K>>(request: B) {
    const { data, error } = await request;
    // This just helps debugging, might prove annoying
    // @ts-expect-error
    if (error) console.debug("[Postgres error]", error, request.url.href);
    return error ? null : data;
}

type Primitive = string | number | boolean | bigint;

export function nullOrTypeSelection<T extends Primitive, Row extends Record<string, unknown>, Result = any, RelationName = any, Relationships = any>(
    builder: PostgrestFilterBuilder<any, Row, Result, RelationName, Relationships>,
    field: string & keyof Row,
    input: T | null
) {
    // @ts-ignore fix later, unimportant
    return input === null ? builder.is(field, null) : builder.eq(field, input);
}

export function folderOrRootToDatabaseType(input: FolderOrRoot) {
    return input === ROOT_FOLDER_ID ? null : input;
}
