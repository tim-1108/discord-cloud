import type { UUID } from "./index.js";
import { patterns } from "./patterns.js";

export function isRecord(obj: any): obj is Record<string, any> {
    return obj !== null && typeof obj === "object" && !Array.isArray(obj);
}

export function isUUID(input: string): input is UUID {
    return patterns.uuid.test(input);
}

/**
 * Checks whether this environment is server-side or this is
 * running inside a browser. If so, some or many features are
 * unavailable and should be bypassed (env variables, working directories).
 *
 * This only applies to common dependencies shared by server and frontend code
 * and should prevent certain features from being used, thus causing errors.
 *
 * The `process` variable is available in all Node situations,
 * but never within a browser/frontend setting.
 */
export function isServerside() {
    return "process" in globalThis;
}
