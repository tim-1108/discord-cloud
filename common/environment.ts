import { createRecordFromKeyValueArrays } from "./useless.js";

/**
 * Uses {@link process.env} to read variables of a given subset and returns them as a record to the callee.
 * This simplies the process of reading these variables, prevents typing mistakes, and, if {@link disableErrorThrow}
 * is `false`, will throw an error if any of them are undefined.
 * @param subset The subset of {@link ENV_SUBSETS} to read from
 * @param disableErrorThrow Makes all variables inside the subset optional. If not given (or `false`), any undefined variable will throw an error.
 * @returns A record of keys of environment variables and their values of this subset
 */
export function getEnvironmentVariables<T extends EnvSubsetKey, Optional extends boolean = false>(
    subset: T,
    disableErrorThrow?: Optional
): EnvSubsetValues<T, Optional> {
    const keys = ENV_SUBSETS[subset];
    const values = keys.map((key) => process.env[key]);
    const missing = values.reduce((acc, val, i) => {
        if (val !== undefined) {
            return acc;
        }
        const key = keys[i];
        acc.push(key);
        return acc;
    }, new Array<string>());
    if (missing.length && !disableErrorThrow) {
        throw new ReferenceError("Missing environment variables in subset " + subset + ": " + missing.join(", "));
    }
    return createRecordFromKeyValueArrays<typeof keys>(keys, values) as EnvSubsetValues<T>;
}

type EnvSubsetKey = keyof typeof ENV_SUBSETS;
type EnvSubsetValues<T extends EnvSubsetKey, Optional extends boolean = false> = {
    [K in (typeof ENV_SUBSETS)[T][number]]: Optional extends true ? string | undefined : string;
};
/**
 * All subsets and their corresponding variables should be defined in this record.
 */
const ENV_SUBSETS = {
    /**
     * PRIVATE_KEY & PUBLIC_KEY:
     * A keypair used for generating JWTs.
     * The keys are encoded in base64 to effectively store them in environment variables.
     * Encode the entire key file (even though the actual key is already encoded in it),
     * as the buffer will be passed to Node's createPrivateKey, which defaults to the PEM
     * format (node/lib/internal/crypto/keys.js#prepareAsymmetricKey)
     */
    manager: ["SERVICE_PASSWORD", "SUPABASE_URL", "SUPABASE_KEY", "MANAGER_PORT", "DISCORD_BOT_TOKEN", "PRIVATE_KEY", "PUBLIC_KEY"],
    "upload-service": ["OWN_ADDRESS", "PORT"],
    service: ["SERVICE_PASSWORD", "MANAGER_ADDRESS"],
    /**
     * Needs to be only supplied to the manager, but is optional and only
     * needed when message encryption is enabled. This value should ideally
     * never change once you have stored messages.
     */
    crypto: ["MESSAGE_ENCRYPTION_KEY"],
    logging: ["DEBUG_LOGGING", "OVERWRITE_LOGGING_FUNCTIONS"]
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
export function validateEnvironmentVariables(...environments: EnvSubsetKey[]): void {
    // If any of them fail, an error is thrown!
    environments.forEach((key) => getEnvironmentVariables(key));
}
