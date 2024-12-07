import type { UUID } from "./index";
import { patterns } from "./patterns";

export function isRecord(obj: any): obj is Record<string, any> {
    return obj !== null && typeof obj === "object" && !Array.isArray(obj);
}

export function isUUID(input: string): input is UUID {
    return patterns.uuid.test(input);
}
