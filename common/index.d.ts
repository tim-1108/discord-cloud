export type UUID = `${string}-${string}-${string}-${string}-${string}`;
export type DataErrorFields<DataType, ErrorType = string, FieldName extends string = "data"> =
    | ({ [K in FieldName]: DataType } & { error: null })
    | ({ [K in FieldName]: null } & { error: ErrorType });
export type ResolveFunctionsRecord<Return = void, Keys = string> = { [K in Keys]: (val: Return) => void };
export type ResolveFunction<Return = void> = (val: Return) => void;
