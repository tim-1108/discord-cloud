import { ref } from "vue";
import { getAuthenticationSync } from "./authentication";
import type { ClientFileHandle } from "../../../common/client";
import { LocalStorageKey, readRawFromStorage } from "./storage";
import { patterns } from "../../../common/patterns";

export function generateDownloadLink(name: string, path: string) {
    const auth = getAuthenticationSync();
    const token = readRawFromStorage(LocalStorageKey.Token, { type: "string", required: true, pattern: patterns.jwt });
    if (auth === null || token === null) {
        // This really should never be able to happen
        throw new ReferenceError("Authentication is not defined upon generating a download link");
    }
    const url = new URL(auth.address);
    url.pathname = "/download";
    // Will, if possible, auto correct to https
    url.protocol = "http:";
    url.searchParams.append("auth", token);
    url.searchParams.append("name", name);
    url.searchParams.append("path", path);
    return url.toString();
}

const previewingImage = ref<string | null>(null);
export function getPreviewingImage() {
    return previewingImage;
}

export function isFileImage(file: ClientFileHandle): boolean {
    return file.type.startsWith("image/");
}
