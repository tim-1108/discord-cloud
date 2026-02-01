import { createClient } from "@supabase/supabase-js";
import type { Database as SupabaseDB } from "../../common/supabase.js";
import { patterns } from "../../common/patterns.js";
import { getEnvironmentVariables } from "../../common/environment.js";

const env = getEnvironmentVariables("manager");
export const supabase = createClient<SupabaseDB>(env.SUPABASE_URL, env.SUPABASE_KEY);

export const ROOT_FOLDER_ID = "root" as const;

export type FolderOrRoot = number | typeof ROOT_FOLDER_ID;

/**
 * Converts a path, ideally of the pattern {@link patterns.stringifiedPath},
 * to a route, a list of subfolders.
 *
 * - /etc/net/secrets => [etc,net,secrets]
 * - Any invalid path will throw an error
 * - The path may optionally also end with a slash
 * @param path
 * @returns
 */
export function pathToRoute(path: string): string[] {
    if (!patterns.stringifiedPath.test(path)) {
        throw new TypeError("Entered invalid path into pathToRoute: " + path);
    }
    if (path === "/") return [];
    // To get only the relevant folders, we remove the first and last slash.
    return path.replace(/(^\/)|(\/$)/g, "").split("/");
}

export function routeToPath(route: string[]): string {
    return `/${route.join("/")}`;
}
