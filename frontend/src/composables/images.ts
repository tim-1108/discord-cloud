import { ref } from "vue";
import type { PartialDatabaseFileRow } from "../../../manager/database/core";
import { getAuthentication } from "./authentication";

export async function generateDownloadLink(name: string, path: string) {
    const auth = await getAuthentication();
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
