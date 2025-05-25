export function validateURLProtocol(link: string, desiredProtocol: string = "https:") {
    try {
        const url = new URL(link);
        return url.protocol === desiredProtocol;
    } catch {
        return false;
    }
}

export function getSearchParamsFromPath(path: string, ...params: string[]) {
    try {
        // The protocol and host do not matter, the url just needs to be parsable
        const url = new URL("http://localhost" + path);
        return params.map((key) => url.searchParams.get(key));
    } catch {
        return params.map(() => null);
    }
}

type GetSearchParamsForAddressReturn<T extends string[]> = Record<T[number], string | null>;

export function getSearchParamsForAddress<T extends string[]>(address: string, ...params: T): GetSearchParamsForAddressReturn<T> {
    const obj: Record<string, string | null> = {};
    for (const key of params) {
        obj[key] = null;
    }

    const hasProtocol = /^[a-z0-9\-]+:/i.test(address);
    const isPath = /^\//.test(address);
    // We will make some assumptions - this still might not yet be valid
    const $address = hasProtocol ? address : isPath ? `http://localhost${address}` : `http://${address}`;

    try {
        const url = new URL($address);
        for (const key of params) {
            obj[key] = url.searchParams.get(key);
        }
    } catch {}
    return obj as GetSearchParamsForAddressReturn<T>;
}

/**
 * Convert a given URL to only use HTTPS and no additional properties besides the domain and port.
 * @param link
 */
export function cleanURL(link: string) {
    try {
        const url = new URL(link);
        url.protocol = "https:";
        url.search = "";
        url.password = "";
        url.username = "";
        url.pathname = "";
        url.hash = "";
        return url.href;
    } catch {
        return null;
    }
}
