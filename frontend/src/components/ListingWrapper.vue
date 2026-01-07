<script setup lang="ts">
import { UncachedListing, type ListingError, type ListingMetadata, type Sort } from "@/composables/listing_uncached";
import { computed, onMounted, ref, toRaw, watch } from "vue";
import type { ClientFileHandle, ClientFolderHandle } from "../../../common/client";
import { appendToRoute, navigateToParentFolder } from "@/composables/path";
import { formatByteString, parseDateObjectToRelative } from "../../../common/useless";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { faFolder } from "@fortawesome/free-solid-svg-icons";
import { getIconForFileType } from "@/composables/icons";
import { generateDownloadLink } from "@/composables/images";

const { path, metadata } = defineProps<{ path: string; metadata: ListingMetadata }>();

const sPageCount = ref(0);
const fPageCount = ref(0);
/**
 * Contains the latest fetched file page.
 * Starts at 1, meaning 0 indicates
 * that no page has been fetched yet
 */
const fPage = ref(0);
/**
 * Contains the latest fetched subfolder page.
 * Starts at 1, meaning 0 indicates
 * that no page has been fetched yet
 */
const sPage = ref(0);

// The sorting for subfolders is taken from this value,
// but the "field" attribute is always set to "name", as that
// is its only option.
// Whenever the sorting is updated, we clear our entire table.
// Sorting does not happen client-side, only on the server.
// We could of course perform sorting if we were to have everything
// on the client, so do that once all pages are loaded.
const sorting: Sort<"files"> = {
    field: "name",
    ascending: true
};

// TODO: concurrency prevention (only one sendout)

const listingType = ref<"grid" | "table">("table");

type NamedMap<T extends { name: string }> = Map<string, T>;

// This is a "soft" error, meaning it is displayed at the bottom of the table.
// There can only always be one. It has to be cleared away before more content
// can even be loaded (by scrolling). This fits to both files and folders, as
// all folders are always fetched first before the files get a turn.
const listingError = ref<ListingError | null>(null);
const files = ref<ClientFileHandle[]>([]);
const subfolders = ref<ClientFolderHandle[]>([]);

async function init() {
    sPageCount.value = Math.ceil(metadata.subfolder_count / metadata.page_size);
    fPageCount.value = Math.ceil(metadata.file_count / metadata.page_size);

    await next();

    // As all folders must have been fetched by now, we can also fetch the first
    // 100 files. We do not use <= 1, because 0 pages of folders means there are
    // none and that via the first next() call, files have already been fetched.
    if (sPageCount.value === 1 && (fPageCount.value ?? 0) /* we know that this cannot be null here */ > 0) {
        await next();
    }
}

async function next() {
    const fn = getAdditionFunction();
    if (!fn) return;
    await fn();
}

function getAdditionFunction(): (() => Promise<void>) | null {
    if (sPageCount.value === null || fPageCount.value === null) return null;

    // Both have already been exhausted.
    // (it is impossible for the values of xPage to exceed xPageCount)
    if (sPageCount.value === sPage.value && fPageCount.value === fPage.value) return null;
    // The listingerror is triggered on any of the two fetch functions, but just means
    // that the user may retry that very page they just tried to fetch again.
    listingError.value = null;

    // Before we even get to the files, the subfolders must be fully exhausted
    if (sPageCount.value > sPage.value) {
        return addSubfolderPage;
    }

    return addFilePage;
}

async function addSubfolderPage() {
    const res = await UncachedListing.getSubfolderPage(path, sPage.value, { ...sorting, field: "name" });
    if (!res.data) {
        listingError.value = res.error;
        return;
    }
    subfolders.value = subfolders.value.concat(res.data);
    // Of course, only incremented when successful
    sPage.value++;
}

async function addFilePage() {
    const res = await UncachedListing.getFilesPage(path, fPage.value, sorting);
    if (!res.data) {
        listingError.value = res.error;
        return;
    }
    files.value = files.value.concat(res.data);
    // Of course, only incremented when successful
    fPage.value++;
}

function openDownloadLink(file: ClientFileHandle) {
    const link = generateDownloadLink(file.name, path);
    window.open(link, "_blank");
}

// TODO: Automatic pagination when reaching the bottom
//       -> intersection observers
//       Showing errors with a retry button, then actually calling next to retry.
//       Maybe saying hey, you reached the end
//       Show total statistics about folder
//       Move out table view into other cmpt
//       Big table, condensed table, grid
//       Design tables and grid like perhaps Onedrive does

onMounted(init);
</script>

<template>
    <div class="grid h-full w-full place-content-center" v-if="!metadata">
        <p>Loading...</p>
    </div>
    <!-- listing error for metadata error fields -->
    <!--<ListingError v-else-if="error" :message="error.message" :can-create="error.can_create" :can-retry="error.can_retry" :path="path"></ListingError>-->
    <template v-else>
        <button @click="next">Next</button>
        <table>
            <thead>
                <tr>
                    <th></th>
                    <th>Name</th>
                    <th>Last Modified</th>
                    <th>Size</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="s of subfolders" @click="appendToRoute([s.name])">
                    <td><FontAwesomeIcon :icon="faFolder"></FontAwesomeIcon></td>
                    <td>{{ s.name }}</td>
                    <td></td>
                    <td></td>
                </tr>
                <tr v-for="f of files" @click="openDownloadLink(f)">
                    <FontAwesomeIcon :icon="getIconForFileType(f.name)"></FontAwesomeIcon>
                    <td>{{ f.name }}</td>
                    <td>{{ parseDateObjectToRelative(new Date(f.updated_at ?? "")) }}</td>
                    <td>{{ formatByteString(f.size) }}</td>
                </tr>
            </tbody>
        </table>
    </template>
</template>

<style scoped>
@import "tailwindcss";
tbody tr {
    @apply hover:bg-gray-200 cursor-pointer;
}
thead th {
    @apply px-1;
}
</style>
