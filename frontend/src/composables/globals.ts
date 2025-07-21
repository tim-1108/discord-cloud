import { getAuthentication, resolvePromise } from "./authentication";

export const globals = {
    authentication: {
        get: getAuthentication,
        resolvePromise
    }
} as const;
