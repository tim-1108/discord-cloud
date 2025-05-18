import { ref, toRaw, watch, type Ref } from "vue";
import { getNamingMaximumLengths, getNegatedCharacterPattern, patterns } from "../../../common/patterns";
import { logError, logWarn } from "../../../common/logging";
import { globals } from "./globals";

const route = ref<string[]>([]);

export function convertPathToRoute(path: string): string[] {
    if (path === "/") {
        return [];
    }
    const untrailed = path.replace(/^\/|\/$/g, "");
    return untrailed.split("/");
}

export function convertRouteToPath(route: string[]): string {
    return `/${route.join("/")}`;
}

export function useCurrentRoute(): Ref<string[]> {
    return route;
}

/**
 * This is a failsafe to prevent unsafe input being saved in the current route
 * and sent off to the server. Anything that writes to `route` should validate
 * its input beforehand. This function tries to fix it, if not possible, revert
 * to `/`.
 *
 * Technically, only direct handlers for user input need to validate that data.
 * Anything the user clicks on - and thus handles a route change for them -
 * should always be safe.
 */
watch(route, (value) => {
    const path = convertRouteToPath(value);
    if (patterns.stringifiedPath.test(path)) return;
    logWarn("A malformed path has been inputted into the route!");
    const correctedPath = checkAndRepairStringPath(path);
    if (!correctedPath) {
        logError("The provided string seems unrepairable, reverting to / from ", path);
        route.value = [];
        return;
    }
    route.value = convertPathToRoute(correctedPath);
});

export function navigateToAbsolutePath(path: string) {
    const checkedPath = checkAndRepairStringPath(path);
    // TODO: build warning/handling system
    if (!checkedPath) return alert("This path is incorrect");
    return navigateToAbsoluteRoute(convertPathToRoute(path));
}

export function navigateToAbsoluteRoute(newRoute: string[]) {
    if (areRoutesIdentical(route.value, newRoute)) return;
    route.value = newRoute;
    void triggerMeOnNavigation();
}

export function navigateUpPath(toIndex: number) {
    if (toIndex >= route.value.length - 1 || !route.value.length || toIndex < 0) return;
    route.value.splice(toIndex + 1, route.value.length - 1);
    void triggerMeOnNavigation();
}

async function triggerMeOnNavigation() {
    const result = await globals.listing.fetch(route.value);
    globals.listing.writeActive(result);
}

export function appendToRoute(folders: string[]) {
    const current = toRaw(route.value);
    return navigateToAbsoluteRoute(current.concat(folders));
}

function areRoutesIdentical(route1: string[], route2: string[]) {
    if (route1.length !== route2.length) return false;
    if (!route1.length) return true;
    return route1.every((value, index) => value === route2[index]);
}

export function convertOptionalRouteToPath(route: string | string[]): string {
    return Array.isArray(route) ? convertRouteToPath(route) : route;
}

/**
 * User input may always be fuzzy.
 *
 * The server expects a clean input, and this function should at least attempt to provide such.
 * @param path The path to check and possible repair
 * @returns The path, if necessary cleaned - or, if it seems "unfixable", `null`
 */
export function checkAndRepairStringPath(path: string): string | null {
    // TODO: Notify the user if any changes had to be made to their input

    if (!path.length || path === "/") {
        return "/";
    }

    // If the path is already correct, we only remove a trailing slash at the end (not required to have that)
    if (patterns.stringifiedPath.test(path)) {
        return path.replace(/\/$/, "");
    }

    // Although backslashes are allowed in folder/file names, we cannot know whether those
    // entered by the user are intended for path seperators (like on windows).
    // Thus, if there are no forward slashes, we will replace ALL backslashes.
    if (!path.includes("/")) path.replace(/\\/g, "/");
    if (path[0] !== "/") path = `/${path}`;

    const route = convertPathToRoute(path);
    if (route.length > maxmiums.subfolderCount) {
        route.splice(maxmiums.subfolderCount /* this index is the entry after the max allowed */, route.length - maxmiums.subfolderCount);
    }
    if (!route.length) {
        return "/";
    }

    route.forEach((value, index) => {
        route[index] = attemptRepairFolderOrFileName(value);
    });

    const newPath = convertRouteToPath(route);
    return patterns.stringifiedPath.test(newPath) ? newPath : null;
}

const negatedSet = getNegatedCharacterPattern();
const maxmiums = getNamingMaximumLengths();
const doubleDotsPattern = /\.{2,}/g;
const emptyStringTag = "?";
function attemptRepairFolderOrFileName(name: string) {
    name = name.replace(doubleDotsPattern, "").replace(negatedSet, emptyStringTag).substring(0, maxmiums.title);
    name ||= emptyStringTag;
    return name;
}
