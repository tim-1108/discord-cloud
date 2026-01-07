<script setup lang="ts">
import FileTable from "./components/listing/FileTable.vue";
import PathRenderer from "./components/PathRenderer.vue";
import { getPreviewingImage } from "./composables/images";
import { globals } from "./composables/globals";
import FolderGrid from "./components/listing/FolderGrid.vue";
import UploadDropOverlay from "./components/overlay/UploadDropOverlay.vue";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { Dialogs } from "./composables/dialog";
import { appendToRoute, convertRouteToPath, navigateToParentFolder, useCurrentRoute } from "./composables/path";
import Sidebar from "./components/Sidebar.vue";
import ThumbnailFileGrid from "./components/listing/ThumbnailFileGrid.vue";
import { faFolderPlus, faLongArrowUp, faRotateRight } from "@fortawesome/free-solid-svg-icons";
import { Connection } from "./composables/connection";
import { PendingAuthenticationState } from "./composables/state";
import { UncachedListing, type ListingError, type ListingMetadata } from "./composables/listing_uncached";
import { getOrCreateCommunicator } from "./composables/authentication";
import { logWarn } from "../../common/logging";

const route = useCurrentRoute();
const path = computed(() => convertRouteToPath(route.value));

const previewImage = getPreviewingImage();

const dropPreview = {
    enabled: ref(false),
    show: (ev: DragEvent) => {
        if (!dropPreview.isAnyFileAttached(ev.dataTransfer) || Dialogs.iterator.value.size) return;
        dropPreview.enabled.value = true;
    },
    hide: (ev: DragEvent) => {
        dropPreview.enabled.value = false;
    },
    isAnyFileAttached(dt: DataTransfer | null) {
        if (!dt) {
            return false;
        }
        return Array.from(dt.items).every(({ kind }) => kind === "file");
    }
};

const isConnected = Connection.isConnected;

const listingMetadata = ref<ListingMetadata | null>(null);
const listingError = ref<ListingError | null>(null);
/**
 * When `path` is updated, this function is called. However,
 * as obtaining the metadata takes some time, the `ListingWrapper`
 * component will already have rerendered, but with the old metadata.
 * Thus, `metadata` also stores a `path` attribute that is compared
 * to the current path. If they do not match, we do not render the
 * component. `ListingWrapper` runs its page and initial fetching
 * logic only on `mount`.
 */
async function fetchListingMetadata() {
    if (PendingAuthenticationState.value !== "established") {
        logWarn("Tried fetching metadata whilst not (yet) being connected!");
        return;
    }
    const res = await UncachedListing.init(path.value);
    listingMetadata.value = res.data;
    listingError.value = res.error;
}
watch(path, fetchListingMetadata);
watch(PendingAuthenticationState, (val) => {
    if (val !== "established") {
        return;
    }
    void fetchListingMetadata();
});
</script>

<template>
    <div class="grid grid-rows-[75px_1fr] grid-cols-[250px_1fr] h-screen relative z-50" @dragover.prevent="dropPreview.show" @drop.prevent="">
        <header class="row-span-1 col-span-2 grid grid-cols-[250px_1fr] items-center">
            <div class="px-4">
                <img class="h-full min-h-0 w-20" src="./assets/logo.png" />
            </div>
            <div>
                <PathRenderer class="lg:w-[50%] lg:max-w-[50%]"></PathRenderer>
            </div>
        </header>

        <Sidebar class="row-span-1 overflow-auto" :folder-id="listingMetadata?.folder_id"></Sidebar>
        <main class="row-span-1 overflow-auto p-4 bg-white rounded-tl-3xl min-h-0">
            <div v-if="!isConnected">
                <span v-if="PendingAuthenticationState === 'health'">Waiting for server to come online</span>
                <span v-else-if="PendingAuthenticationState === 'login'">Logging in</span>
                <span v-else-if="PendingAuthenticationState === 'pending'">Waiting for credentials</span>
                <span v-else-if="PendingAuthenticationState === 'establishing'">Establishing connection</span>
                <span v-else-if="PendingAuthenticationState === 'established'">Connected</span>
            </div>
            <ListingWrapper
                :path="path"
                :key="path"
                v-else-if="listingMetadata && listingMetadata.path === path"
                :metadata="listingMetadata"></ListingWrapper>
        </main>
        <component v-for="[k, cmp] of Dialogs.iterator.value" :is="cmp" :key="k"></component>
        <UploadDropOverlay
            v-if="dropPreview.enabled.value"
            @hide="dropPreview.enabled.value = false"
            subtitle="Dropping files will open a view"></UploadDropOverlay>
    </div>
</template>
