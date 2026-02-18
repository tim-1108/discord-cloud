<script setup lang="ts">
import { UncachedListing, type ListingError, type ListingMetadata, type Sort } from "@/composables/listing_uncached";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { ClientFileHandle, ClientFolderHandle } from "../../../common/client";
import { appendToRoute, navigateToParentFolder } from "@/composables/path";
import { generateDownloadLink } from "@/composables/images";
import { ListingSortAscendingState, ListingSortFieldState } from "@/composables/state";

const { path } = defineProps<{ path: string }>();

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

const listingType = ref<"grid" | "table">("table");

type NamedMap<T extends { name: string }> = Map<string, T>;

// This is a "soft" error, meaning it is displayed at the bottom of the table.
// There can only always be one. It has to be cleared away before more content
// can even be loaded (by scrolling). This fits to both files and folders, as
// all folders are always fetched first before the files get a turn.
const listingError = ref<{ error: ListingError; retryFn: () => any | Promise<any> } | null>(null);
const files = ref<ClientFileHandle[]>([]);
const subfolders = ref<ClientFolderHandle[]>([]);

const metadata = ref<ListingMetadata | null>(null);

async function stageOne(): Promise<boolean> {
    // This function should only be called again if it failed initially
    if (metadata.value) {
        throw new ReferenceError("Listing metadata is already defined, clear before calling stageOne()");
    }
    listingError.value = null;
    const res = await UncachedListing.init(path);
    if (!res.data) {
        listingError.value = { error: res.error, retryFn: stageOne };
        return false;
    }
    metadata.value = res.data;
    listingError.value = null;
    // TODO: These callbacks should affect something.
    UncachedListing.register(
        metadata.value,
        () => {},
        () => {}
    );
    void stageTwo();
    return true;
}

function unregister(): boolean {
    if (!metadata.value) return false;
    UncachedListing.unregister();
    return true;
}

async function stageTwo(): Promise<boolean> {
    if (isLocked.value || !metadata.value) return false;
    isLocked.value = true;

    sPageCount.value = Math.ceil(metadata.value.subfolder_count / metadata.value.page_size);
    fPageCount.value = Math.ceil(metadata.value.file_count / metadata.value.page_size);

    const successOne = await next();
    if (successOne === false) {
        isLocked.value = false;
        return false;
    }

    // As all folders must have been fetched by now, we can also fetch the first
    // 100 files. We do not use <= 1, because 0 pages of folders means there are
    // none and that via the first next() call, files have already been fetched.
    if (sPageCount.value === 1 && (fPageCount.value ?? 0) /* we know that this cannot be null here */ > 0) {
        const successTwo = await next();
        if (successTwo === null) {
            // This should not be able to happen because this segment of code is
            // only called when we know that there is a next page. getAdditionFunction
            // should always produce the same result.
            throw new Error("Mismatch between stageTwo and next");
        }
        if (!successTwo) {
            isLocked.value = false;
            return false;
        }
    }
    isLocked.value = false;
    return true;
}

function wrapper_nextFromScrollEnd() {
    if (isLocked.value) return;
    return next();
}

async function next(): Promise<boolean | null> {
    const fn = getAdditionFunction();
    if (!fn) return null;
    const wasAlreadyLocked = isLocked.value === true;
    isLocked.value = true;
    const flag = await fn();
    // If `next` was called via the `init` function, there may
    // yet be another call to this function here. Thus, we'd
    // never want to set locked to false here.
    if (!wasAlreadyLocked) isLocked.value = false;
    return flag;
}

function getAdditionFunction(): (() => Promise<boolean>) | null {
    if (!hasNext.value) return null;

    // The listingerror is triggered on any of the two fetch functions, but just means
    // that the user may retry that very page they just tried to fetch again.
    listingError.value = null;

    // Before we even get to the files, the subfolders must be fully exhausted
    if (sPageCount.value > sPage.value) {
        return addSubfolderPage;
    }

    return addFilePage;
}

const hasNext = computed(() => {
    if (sPageCount.value === null || fPageCount.value === null) return false;

    // Both have already been exhausted.
    // (it is impossible for the values of xPage to exceed xPageCount)
    if (sPageCount.value === sPage.value && fPageCount.value === fPage.value) return false;
    return true;
});

/**
 * The sorting for subfolders is taken from this value,
 * but the "field" attribute is always set to "name", as that
 * is its only option.
 * Whenever the sorting is updated, we clear our entire table.
 * Sorting does not happen client-side, only on the server.
 * We could of course perform sorting if we were to have everything
 * on the client, so do that once all pages are loaded.
 */
function getSorting(): Sort<"files"> {
    return {
        field: ListingSortFieldState.value,
        ascending: ListingSortAscendingState.value
    };
}

async function addSubfolderPage(): Promise<boolean> {
    const res = await UncachedListing.getSubfolderPage(path, sPage.value, { ...getSorting(), field: "name" });
    if (!res.data) {
        listingError.value = { error: res.error, retryFn: addSubfolderPage };
        return false;
    }
    subfolders.value = subfolders.value.concat(res.data);
    // Of course, only incremented when successful
    sPage.value++;
    return true;
}

async function addFilePage(): Promise<boolean> {
    const res = await UncachedListing.getFilesPage(path, fPage.value, getSorting());
    if (!res.data) {
        listingError.value = { error: res.error, retryFn: addFilePage };
        return false;
    }
    files.value = files.value.concat(res.data);
    listingError.value = null;
    // Of course, only incremented when successful
    fPage.value++;
    return true;
}

function openDownloadLink(file: ClientFileHandle) {
    const link = generateDownloadLink(file.name, path);
    window.open(link, "_blank");
}

/**
 * Disallows any sorting or selection operations within
 * the subcomponents. Used when the user has just sorted
 * the table and we are awaiting a response from the server.
 *
 * While this is `true`, the component should not actually
 * render the items, but only show animated empty boxes, indicating
 * loading.
 */
const isLocked = ref(false);
function onSortRequest() {
    if (isLocked.value) return;
    subfolders.value = [];
    files.value = [];
    sPage.value = 0;
    fPage.value = 0;
    void stageTwo();
}

// === handlers for all error callbacks ===
function error$navigateUp() {
    navigateToParentFolder();
}
function error$retry() {
    if (!listingError.value) return;
    const { retryFn } = listingError.value;
    void retryFn();
}

onMounted(stageOne);
onBeforeUnmount(unregister);
</script>

<template>
    <p v-if="!metadata && !listingError">Loading...</p>
    <!-- listing error for metadata error fields -->
    <ListingError
        v-else-if="listingError"
        :message="listingError.error.message"
        :can-create="listingError.error.can_create"
        :can-retry="listingError.error.can_retry"
        :path="path"
        @retry="error$retry"
        @navigate-up="error$navigateUp"></ListingError>
    <ListingTable
        v-else
        :files="files"
        :subfolders="subfolders"
        :locked="isLocked"
        :has-next="hasNext"
        @up="navigateToParentFolder"
        @down="(name) => appendToRoute([name])"
        @sort="onSortRequest"
        @load-next="wrapper_nextFromScrollEnd"
        @open-file="openDownloadLink"></ListingTable>
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
