import { isRecord } from "./types.ts";

/**
 * Used for validating the max value of a number and the length of a string.
 */
const MAX_POSITIVE_INTEGER = Math.pow(2, 31) - 1;
/**
 * Used for validating the min value of a number
 */
const MAX_NEGATIVE_INTEGER = -Math.pow(2, 31);

interface ValidationResponse {
    invalid: boolean;
    offenses: OffenseDetails[];
}
interface OffenseDetails {
    key: string;
    offense: SchemaOffense;
    schema: SerializedSchemaEntry;
    /**
     * Used on type = "record" for layering sub-validations
     */
    items?: ValidationResponse;
}

export function validateObjectBySchema(object: any, consumer: SchemaEntryConsumer): ValidationResponse {
    if (!isRecord(object)) return { invalid: true, offenses: [] };
    const schemas = new Set(Object.keys(consumer));

    // Keys which are not defined in the schema may NOT
    // be inside the record.
    const keys = Object.keys(object);
    for (const key of keys) {
        if (schemas.has(key)) continue;
        return { invalid: true, offenses: [] };
    }

    const offenses: OffenseDetails[] = [];
    for (const key of schemas) {
        const schema = consumer[key];
        const value = object[key];

        function invalidateKey(offense: SchemaOffense, items?: ValidationResponse) {
            offenses.push({ key, offense, schema: serializeSchemaEntry(schema), items });
        }

        if (typeof value === "undefined" || value == null) {
            if (schema.required) invalidateKey("required_missing");
            // If it is not required and not set, we continue to the next key w/o any issues.
            continue;
        }

        if (schema.validator_function) {
            const result = schema.validator_function(value);
            if (!result) {
                invalidateKey("validator_function_failed");
                continue;
            }
        }

        // The sub-validate functions do not return anything,
        // but push the correct offense if needed by calling invalidateKey.

        if (schema.type === "string") validateStringSchema(schema, value, invalidateKey);
        else if (schema.type === "number") validateNumberSchema(schema, value, invalidateKey);
        else if (schema.type === "boolean") validateBooleanSchema(schema, value, invalidateKey);
        else if (schema.type === "record") validateRecordSchema(schema, value, invalidateKey);
        else throw new SyntaxError("Invalid type for validation");
    }

    return { invalid: offenses.length > 0, offenses };
}

type InvalidateFunction = (offense: SchemaOffense, items?: ValidationResponse) => void;

function validateStringSchema(schema: StringSchemaEntry, value: any, func: InvalidateFunction) {
    if (typeof value !== "string") return func("incorrect_type");

    if (schema.pattern && !schema.pattern.test(value)) return func("pattern_no_match");

    const min = schema.min_length ?? 0;
    const max = schema.max_length ?? MAX_POSITIVE_INTEGER;

    if (value.length > max) return func("too_large");
    // Impossible for lengths smaller than 0
    if (value.length < min) return func("too_small");

    if (schema.options && !schema.options.includes(value)) return func("not_valid_option");
}

function validateNumberSchema(schema: NumberSchemaEntry, value: any, func: InvalidateFunction) {
    if (typeof value !== "number") return func("incorrect_type");

    const min = schema.min ?? MAX_NEGATIVE_INTEGER;
    const max = schema.max ?? MAX_POSITIVE_INTEGER;

    if (Number.isNaN(value)) return func("unfit_size");

    if (value < min) return func("too_small");
    if (value > max) return func("too_large");
    if (typeof schema.exact === "number" && value !== schema.exact) return func("not_expected_value");

    // isSafeInteger not only checks whether the number is in a safe range
    // but also whether it is an integer (no other easy way to do that)
    if (!schema.allow_floats && !Number.isSafeInteger(value)) return func("float_disallowed");

    if (schema.options && !schema.options.includes(value)) return func("not_valid_option");
}

function validateBooleanSchema(schema: BooleanSchemaEntry, value: any, func: InvalidateFunction) {
    if (typeof value !== "boolean") return func("incorrect_type");

    if (typeof schema.expected === "boolean" && value !== schema.expected) return func("not_expected_value");
}

function validateRecordSchema(schema: RecordSchemaEntry, value: any, func: InvalidateFunction) {
    if (!isRecord(value)) return func("incorrect_type");
    const validation = validateObjectBySchema(value, schema.items);
    if (validation.invalid) return func("items_invalid", validation);
}

type SchemaOffense =
    | "required_missing"
    | "too_small"
    | "too_large"
    | "unfit_size"
    | "incorrect_type"
    | "pattern_no_match"
    | "validator_function_failed"
    | "float_disallowed"
    | "not_valid_option"
    | "not_expected_value"
    | "items_invalid";

export type SchemaEntryConsumer = Record<string, SchemaEntry>;

interface BaseSchemaEntry {
    type: string;
    /**
     * Makes fields required. (They cannot be null nor undefined)
     */
    required?: boolean;
    /**
     * Allows for custom checks on schema entries.
     *
     * Returns whether the data provided is correct.
     * (true -> valid, false -> invalid)
     *
     * Is run after the check of {@link BaseSchemaEntry.required} has passed.
     * @param value The value that is meant to be checked
     */
    validator_function?: (value: any) => boolean;
}

interface StringSchemaEntry extends BaseSchemaEntry {
    type: "string";
    /**
     * The minimum length the string may have.
     *
     * Defaults to 0.
     */
    min_length?: number;
    /**
     * The max length the string may have.
     *
     * Defaults to {@link MAX_POSITIVE_INTEGER}
     */
    max_length?: number;
    pattern?: RegExp;
    options?: string[];
}

interface NumberSchemaEntry extends BaseSchemaEntry {
    type: "number";
    min?: number;
    max?: number;
    exact?: number;
    options?: number[];
    /**
     * Allowing floats needs to be specified explicitly.
     *
     * Parsing still uses {@link parseFloat} even if disabled, an integer parsed using that
     * function still passes the {@link Number.isSafeInteger} check.
     */
    allow_floats?: boolean;
}

/**
 * If a query object is parsed, the boolean value will be inferred from the strings "1", "0", "true" and "false".
 *
 * When parsing a JSON object, only the primitive boolean type is allowed.
 */
interface BooleanSchemaEntry extends BaseSchemaEntry {
    type: "boolean";
    expected?: boolean;
}

interface RecordSchemaEntry extends BaseSchemaEntry {
    type: "record";
    /**
     * Infinite layers! YES!
     */
    items: SchemaEntryConsumer;
}

export type SchemaEntry = StringSchemaEntry | NumberSchemaEntry | BooleanSchemaEntry | RecordSchemaEntry;

interface SerializedSchemaEntry extends BaseSchemaEntry {
    pattern?: string;
    has_validator_function: boolean;
}
function serializeSchemaEntry(entry: SchemaEntry): SerializedSchemaEntry {
    // Only overwrites the pattern property of entry, takes everything else as is
    return Object.assign({}, entry, {
        pattern: "pattern" in entry ? entry.pattern?.toString() : undefined,
        has_validator_function: !!entry.validator_function
    });
}

type SchemaEntryType<T extends SchemaEntry> = T extends StringSchemaEntry
    ? string
    : T extends NumberSchemaEntry
      ? number
      : T extends BooleanSchemaEntry
        ? boolean
        : T extends RecordSchemaEntry
          ? SchemaToType<T["items"]>
          : unknown;

export type SchemaToType<T extends SchemaEntryConsumer | null> = {
    [K in keyof T]: T extends SchemaEntryConsumer ? SchemaEntryType<T[K]> : null;
};
