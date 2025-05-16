import { ref } from "vue";
import type { PartialDatabaseFileRow } from "../../../manager/database/core";
import { getAuthenticationSync } from "./authentication";

export async function generateDownloadLink(name: string, path: string) {
    const auth = getAuthenticationSync();
    if (auth === null) {
        // This really should never be able to happen
        throw new ReferenceError("Authentication is not defined upon generating a download link");
    }
    const url = new URL(auth.address);
    url.pathname = "/download";
    // Will, if possible, auto correct to https
    url.protocol = "http:";
    url.searchParams.append("auth", auth.password);
    url.searchParams.append("name", name);
    url.searchParams.append("path", path);
    return url.toString();
}

const previewingImage = ref<string | null>(null);
export function getPreviewingImage() {
    return previewingImage;
}

export function isFileImage(file: PartialDatabaseFileRow): boolean {
    return file.type.startsWith("image/");
}
