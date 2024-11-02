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
