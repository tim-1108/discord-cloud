export type UUID = `${string}-${string}-${string}-${string}-${string}`;
type UUIDPrefix = "file-lock" | "folder-lock";
export type PrefixedUUIDS = {
    [K in UUIDPrefix]: PrefixedUUID<K>;
};
export type PrefixedUUID<T extends UUIDPrefix> = `${prefix}:${UUID}`;
export type DataErrorFields<DataType, ErrorType = string, FieldName extends string = "data"> =
    | ({ [K in FieldName]: DataType } & { error: null })
    | ({ [K in FieldName]: null } & { error: ErrorType });
export type ResolveFunctionsRecord<Return = void, Keys = string> = { [K in Keys]: (val: Return) => void };
export type ResolveFunction<Return = void> = (val: Return) => void;
