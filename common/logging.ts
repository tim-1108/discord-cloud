import { getEnvironmentVariables } from "./environment.js";
import { isServerside } from "./types.js";

type LogLevel = keyof typeof NATIVE_FUNCTION_MAP;

const NATIVE_FUNCTION_MAP = {
    debug: console.debug, // Just an alias for console.log, is not logged if debug is disabled
    info: console.log,
    warn: console.warn, // Technically an alias for console.error (so stderr), browsers/console hosts may also show a difference
    error: console.error
} as const;

function getCurrentTimestamp() {
    const date = new Date(Date.now());
    return `[${fillOutNumber(date.getHours())}:${fillOutNumber(date.getMinutes())}:${fillOutNumber(date.getSeconds())}]`;
}

function fillOutNumber(num: Number) {
    return num.toString(10).padStart(2, "0");
}

function log(level: LogLevel, ...data: any[]): void {
    const nativeFn = NATIVE_FUNCTION_MAP[level];
    const traceError = new Error("generated error for logging trace");
    const cwd = isServerside() ? process.cwd() : "";
    const stack = traceError.stack ? traceError.stack.split("\n") : [];
    // When tracing the error, Bun does not have the logInfo, logDebug, ... function
    // within it's stacktrace. Node (and Deno) do have this function included in the trace.
    // Browsers (Firefox, to current testing) do not have it within the trace.
    const isBun = "Bun" in globalThis || "window" in globalThis;
    /**
     * The indicies are as follows:
     * 0: "Error:"
     * 1st: this very function
     * NOTE: Any other function in here (logInfo) seems to be skipped in that process as it just returns a call to this
     * 2nd: the actual callee
     *
     * Replacing "    at " as a prefix for the stack line should work on all
     * V8 based engines and Firefox.
     *
     * For Windows paths, all backslashes will be replaced by normal slashes.
     */
    const callee =
        stack.length >= (isBun ? 3 : 4)
            ? stack[isBun ? 2 : 3]
                  .replace(/^    at /, "")
                  .replace(cwd, "")
                  .replace(/\\/g, "/")
            : "unknown";
    nativeFn(getCurrentTimestamp(), `[${level.toUpperCase()}]`, `[${callee}]`, ...data);
}

/**
 * Log anything at the debug level.
 *
 * Only logs something if the environment variable "DEBUG_LOGGING" is 1
 * @param data Anything that can be logged using `console.log`
 */
export function logDebug(...data: any[]): void {
    if (isServerside()) {
        const env = getEnvironmentVariables("logging", true);
        if (env.DEBUG_LOGGING !== "1") return;
    }
    return log("debug", ...data);
}

/**
 * Log anything at the info level.
 * @param data Anything that can be logged using `console.log`
 */
export function logInfo(...data: any[]): void {
    return log("info", ...data);
}

/**
 * Log anything at the warning level.
 * @param data Anything that can be logged using `console.warn`
 */
export function logWarn(...data: any[]): void {
    return log("warn", ...data);
}

/**
 * Log anything at the error level.
 * @param data Anything that can be logged using `console.error`
 */
export function logError(...data: any[]): void {
    return log("error", ...data);
}

// Only if so chosen, also overwrite default logging functions
if (isServerside() && getEnvironmentVariables("logging", true).OVERWRITE_LOGGING_FUNCTIONS === "1") {
    console.debug = logDebug;
    console.log = logInfo;
    console.info = logInfo;
    console.warn = logWarn;
    console.error = logError;
}
