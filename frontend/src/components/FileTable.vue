<script setup lang="ts">
import { parseFileSize } from "../../../common/useless";
import { generateDownloadLink, getPreviewingImage, isFileImage } from "@/composables/images";
import { convertRouteToPath, useCurrentRoute } from "@/composables/path";
import type { Listing } from "@/composables/listing";
import type { ClientFileHandle } from "../../../common/client";

const props = defineProps<{ listing: Listing }>();
const route = useCurrentRoute();
async function openImageOrDownload(file: ClientFileHandle) {
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
    <table v-if="typeof listing !== 'string'" class="w-full gap-y-4">
        <thead>
            <tr>
                <th>Select</th>
                <th>Name</th>
                <th>Last Updated</th>
                <th>Size</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>
            <tr v-for="file of listing.files" class="" @click="openImageOrDownload(file)">
                <td></td>
                <td>{{ file.name }}</td>
                <td>{{ file.updated_at }}</td>
                <td>{{ parseFileSize(file.size) }}</td>
            </tr>
        </tbody>
    </table>
    <div v-else>{{ listing }}</div>
</template>

<style scoped>
@import "tailwindcss";

tbody tr {
    border-color: #444444;
    border-width: 1px 0 1px 0;
}
thead th {
    @apply text-start;
}
</style>
