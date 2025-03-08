import { ref, toRaw, type Ref } from "vue";
import { getNamingMaximumLengths, getNegatedCharacterPattern, patterns } from "../../../common/patterns";
import { updateListingForCurrentDirectory } from "./listing";

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

export function navigateToAbsolutePath(path: string) {
    const checkedPath = checkAndRepairStringPath(path);
    // TODO: build warning/handling system
    if (!checkedPath) return alert("This path is incorrect");
    return navigateToAbsoluteRoute(convertPathToRoute(path));
}

export function navigateToAbsoluteRoute(newRoute: string[]) {
    if (areRoutesIdentical(route.value, newRoute)) return;
    route.value = newRoute;
    updateListingForCurrentDirectory();
}

export function navigateUpPath(toIndex: number) {
    if (toIndex >= route.value.length - 1 || !route.value.length || toIndex < 0) return;
    route.value.splice(toIndex + 1, route.value.length - 1);
    updateListingForCurrentDirectory();
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

/**
 * User input may always be fuzzy.
 *
 * The server expects a clean input, and this function should at least attempt to provide such.
 * @param path The path to check and possible repair
 * @returns The path, if necessary cleaned - or, if it seems "unfixable", `null`
 */
export function checkAndRepairStringPath(path: string): string | null {
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
