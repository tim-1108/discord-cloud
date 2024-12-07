import { areAllEntriesDefined, createRecordFromKeyValueArrays } from "./useless.ts";

export function getEnvironmentVariables<T extends EnvSubsetKey>(subset: T): EnvSubsetValues<T> {
    const keys = ENV_SUBSETS[subset];
    const values = keys.map((key) => process.env[key]);
    if (!areAllEntriesDefined(values)) throw new ReferenceError("Missing environment variables in subset " + subset);
    return createRecordFromKeyValueArrays<typeof keys, string>(keys, values) as EnvSubsetValues<T>;
}

type EnvSubsetKey = keyof typeof ENV_SUBSETS;
type EnvSubsetValues<T extends EnvSubsetKey> = {
    [K in (typeof ENV_SUBSETS)[T][number]]: string;
};
const ENV_SUBSETS = {
    common: ["CRYPTO_KEY"],
    manager: ["SERVICE_PASSWORD", "CLIENT_PASSWORD", "SUPABASE_URL", "SUPABASE_KEY", "DISCORD_CHANNEL_ID"],
    "upload-service": ["PASSWORD", "OWN_ADDRESS", "MANAGER_ADDRESS", "ENCRYPTION", "WEBHOOK_URL", "PORT"]
} as const;

/**
 * Use at startup to make sure the environment variables for
 * a specific service/environment exist.
 *
 * Does not return anything, throws an error!
 *
 * Validate them at the start of the application,
 * instead of later realizing some might be missing.
 * @param environments An array of types to validate multiple at once
 */
export function validateEnviromentVariables(...environments: EnvSubsetKey[]): void {
    // If any of them fail, an error is thrown!
    environments.forEach(getEnvironmentVariables);
}
