import { logError } from "../../../common/logging";
import { patterns } from "../../../common/patterns";
import { getAuthenticationToken, getServerAddress } from "./authentication";

export async function createSignedDownloadLink(path: string, name: string) {
    const token = getAuthenticationToken();
    const address = await getServerAddress();
    address.pathname = "/generate-signed-download";
    const sp = address.searchParams;
    sp.append("auth", token);
    sp.append("path", path);
    sp.append("name", name);
    try {
        const res = await fetch(address, { method: "GET" });
        if (!res.ok) throw new Error("Fetch failed");
        const text = await res.text();
        if (!patterns.base64Url.test(text)) throw new Error("Signed download data in invalid format");

        const target = new URL(await getServerAddress() /* dont re-use the address from above! */);
        target.pathname = "/signed-download";
        target.searchParams.append("q", text);
        return target;
    } catch (error) {
        logError(`Failed to generate signed download link for "${name}" at path "${path}" due to`, error);
        return null;
    }
}
