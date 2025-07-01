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
import { isListingError } from "./composables/listing";
import { faFolderPlus, faLongArrowUp, faRotateRight } from "@fortawesome/free-solid-svg-icons";
import { Connection } from "./composables/connection";
import { PendingAuthenticationState } from "./composables/state";

const listing = globals.listing.active;
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

const listingType = ref<"grid" | "table">("grid");
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

        <Sidebar class="row-span-1 overflow-auto"></Sidebar>
        <main class="row-span-1 overflow-auto p-4 bg-white rounded-tl-3xl min-h-0">
            <div v-if="!isConnected">
                <span v-if="PendingAuthenticationState === 'health'">Waiting for server to come online</span>
                <span v-else-if="PendingAuthenticationState === 'login'">Logging in</span>
                <span v-else-if="PendingAuthenticationState === 'pending'">Waiting for credentials</span>
                <span v-else-if="PendingAuthenticationState === 'establishing'">Establishing connection</span>
                <span v-else-if="PendingAuthenticationState === 'established'">Connected</span>
            </div>
            <div v-else-if="listing === null" class="grid h-full w-full place-content-center">
                <p>Loading...</p>
            </div>
            <div v-else-if="isListingError(listing)" class="grid h-full w-full place-content-center">
                <section class="bg-[var(--component-color)] shadow rounded-xl py-2 px-4 grid justify-items-center gap-2">
                    <h3>An Error Occured</h3>
                    <span>{{ listing.code }}</span>
                    <div class="grid md:flex gap-2">
                        <HighlightButton :icon="faLongArrowUp" styling="default" v-if="route.length">Go Up</HighlightButton>
                        <HighlightButton :icon="faRotateRight" styling="default" v-if="listing.can_retry">Retry</HighlightButton>
                        <HighlightButton :icon="faFolderPlus" styling="default" v-if="listing.can_create_folder">Create</HighlightButton>
                    </div>
                </section>
            </div>
            <div v-else class="grid gap-2" :key="path">
                <div class="flex justify-between items-end gap-4 flex-wrap">
                    <h3>Folders</h3>
                    <ListingTypeChooser :default-value="listingType" @update="(val) => (listingType = val)"></ListingTypeChooser>
                </div>
                <FolderGrid
                    v-if="listingType === 'grid'"
                    :folder-list="listing.folders"
                    :show-up="route.length > 0"
                    @navigate="(name) => appendToRoute([name])"
                    @navigate-up="navigateToParentFolder"></FolderGrid>
                <FolderTable v-else :folder-list="listing.folders"></FolderTable>
                <h3>Files</h3>
                <ThumbnailFileGrid v-if="listingType === 'grid'" :file-list="listing.files"></ThumbnailFileGrid>
                <FileTable v-else :file-list="listing.files"></FileTable>
            </div>
        </main>
        <component v-for="[k, cmp] of Dialogs.iterator.value" :is="cmp" :key="k"></component>
        <UploadDropOverlay
            v-if="dropPreview.enabled.value"
            @hide="dropPreview.enabled.value = false"
            subtitle="Dropping files will open a view"></UploadDropOverlay>
    </div>
</template>
