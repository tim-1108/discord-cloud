import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types.js";
import { patterns } from "../../common/patterns.js";
import { createFolderWithParent } from "./creating.js";
import { findFolderByNameAndParent } from "./finding.js";
import { getEnvironmentVariables } from "../../common/environment.js";

export type DatabaseFileRow = Database["public"]["Tables"]["files"]["Row"];
export type DatabaseFolderRow = Database["public"]["Tables"]["folders"]["Row"];

/**
 * This type omits all the properties not intended to be returned to the user.
 * Returning these properties does not create a security risk,
 * but just contains useless data.
 */
export type PartialDatabaseFileRow = Omit<DatabaseFileRow, "id" | "folder" | "hash" | "messages" | "is_encrypted" | "channel">;
export type PartialDatabaseFolderRow = Omit<DatabaseFolderRow, "parent_folder">;

const env = getEnvironmentVariables("manager");
export const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_KEY);

export const ROOT_FOLDER_ID = "root" as const;

export type FolderOrRoot = number | typeof ROOT_FOLDER_ID;

type FolderCacheValue = { id: FolderOrRoot; subfolders: FolderCache; nonExistentSubfolders: Set<string> };
type FolderCache = Map<string, FolderCacheValue>;
/**
 * A cache containing a folder IDs mapped to folder names and subfolders.
 *
 * The system caches all known subfolders and all folders it knows for sure do not exist.
 */
const folderCache: FolderCacheValue = { id: ROOT_FOLDER_ID, subfolders: new Map(), nonExistentSubfolders: new Set() };

/**
 * Converts a path, ideally of the pattern {@link patterns.stringifiedPath},
 * to a route, a list of subfolders.
 *
 * - /etc/net/secrets => [etc,net,secrets]
 * - Any invalid path will fail and return null
 * - The path may optionally also end with a slash
 * @param path
 * @returns
 */
function pathToRoute(path: string): string[] | null {
    if (!patterns.stringifiedPath.test(path)) return null;
    // To get only the relevant folders, we remove the first and last slash.
    return path.replace(/(^\/)|(\/$)/g, "").split("/");
}

/**
 * Retrieves the "id" field from the database from the last item of the path.
 *
 * If root is specified, {@link ROOT_FOLDER_ID} is returned.
 *
 * Use {@link invalidateFolderCache} with a path to invalidate the last item,
 * should anything about it change (removed, renamed).
 *
 * When {@link shouldCreateFolders} is true, the cache will be updated
 * automatically if subfolders are created.
 * @param path The full path of the folder
 * @param shouldCreateFolders Whether non-existing folders along the path should be created
 * @returns The database "id" field or null, if non-existent
 */
export async function resolvePathToFolderId_Cached(path: string, shouldCreateFolders?: boolean): Promise<FolderOrRoot | null> {
    const route = pathToRoute(path);
    if (!route) return null;
    // In this case, the root folder is passed.
    // When splitting an empty string with "/", the length of the array is still 1
    if (route.length === 1 && route[0] === "") return ROOT_FOLDER_ID;

    // We start with the root
    let parent = folderCache;

    /**
     * Navigates the cache tree a layer deeper by creating a new entry inside the map
     * of the current folder.
     * It then sets the subfolder as the current folder for the loop.
     *
     * This automatically updates the folder cache as everything
     * still happens inside the layers of {@link folderCache}
     * @param name
     * @param id
     */
    function setNewParent(name: string, id: number) {
        const value = { id, subfolders: new Map() as FolderCache, nonExistentSubfolders: new Set<string>() };
        parent.subfolders.set(name, value);
        return value;
    }

    for (let i = 0; i < route.length; i++) {
        const name = route[i];

        // Scenario 1: We know the folder does not exist.
        // If the caller wishes it, we will create it.
        if (parent.nonExistentSubfolders.has(name)) {
            if (!shouldCreateFolders) {
                return null;
            }
            const result = await createFolderWithParent(name, parent.id);
            if (!result) return null;
            parent.nonExistentSubfolders.delete(name);
            parent = setNewParent(name, result.id);
            continue;
        }

        // Scenario 2: The subfolder is already cached
        const mappedValue = parent.subfolders?.get(name);
        if (mappedValue) {
            parent = mappedValue;
            continue;
        }
        const result = await findFolderByNameAndParent(name, parent.id);
        // Scenario 3: The folder does not yet even exist
        if (!result) {
            if (!shouldCreateFolders) {
                parent.nonExistentSubfolders.add(name);
                return null;
            }
            const result = await createFolderWithParent(name, parent.id);
            if (!result) {
                return null;
            }
            parent = setNewParent(name, result.id);
            continue;
        }
        // Scenario 4: The folder exists, but has not been cached yet
        parent = setNewParent(name, result.id);
    }

    // Assuming the loop has set the last subfolder as the last parent
    return parent.id;
}

/**
 * Invalidates the cache for the last entry of the path given
 * @param path The path of which the last item is to be invalidated
 */
export function invalidateFolderCache(path: string) {
    const route = pathToRoute(path);
    if (!route || (route.length === 1 && route[0] === "")) return false;

    let parent = folderCache;
    for (let i = 0; i < route.length; i++) {
        const name = route[i];
        const value = parent.subfolders.get(name);

        // Even if it is the last index (the thing the want to delete),
        // we still fail due to us not being able to invalidate something that is not cached.
        if (!value) return false;

        if (i === route.length - 1) {
            return parent.subfolders.delete(name) || parent.nonExistentSubfolders.delete(name);
        }
        parent = value;
    }

    return false;
}
