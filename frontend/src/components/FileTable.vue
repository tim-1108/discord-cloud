<script setup lang="ts">
import { useCurrentFolderListing } from "@/composables/listing";
import { parseFileSize } from "../../../common/useless";
import { generateDownloadLink, getPreviewingImage, isFileImage } from "@/composables/images";
import type { PartialDatabaseFileRow } from "../../../manager/database/core";
import { convertRouteToPath, route } from "@/composables/path";
import { watch } from "vue";

watch(
    route,
    (value, oldValue) => {
        debugger;
    },
    { deep: true }
);

const listing = useCurrentFolderListing();
async function openImageOrDownload(file: PartialDatabaseFileRow) {
    console.log(route.value, convertRouteToPath(route.value));
    const link = await generateDownloadLink(file.name, convertRouteToPath(route.value));
    if (isFileImage(file)) {
        getPreviewingImage().value = link;
        return;
    }
    window.open(link, "_blank");
}
</script>

<template>
    <p>{{ route }}</p>
    <table v-if="typeof listing !== 'string'">
        <thead>
            <tr>
                <th>Select</th>
                <th>Name</th>
                <th>Size</th>
                <th>Created at</th>
                <th>Updated at</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>
            <tr v-for="file of listing.files" @click="openImageOrDownload(file)">
                <td></td>
                <td>{{ file.name }}</td>
                <td>{{ parseFileSize(file.size) }}</td>
                <td>{{ file.created_at }}</td>
                <td>{{ file.updated_at }}</td>
            </tr>
        </tbody>
    </table>
    <div v-else>{{ listing }}</div>
</template>
