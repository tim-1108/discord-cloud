<script setup lang="ts">
import FileTable from "./components/FileTable.vue";
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
            <div v-if="listing" class="grid gap-2" :key="path">
                <h3>Folders</h3>
                <FolderGrid
                    :folder-list="listing.folders"
                    :show-up="route.length > 0"
                    @navigate="(name) => appendToRoute([name])"
                    @navigate-up="navigateToParentFolder"></FolderGrid>
                <h3>Files</h3>
                <ThumbnailFileGrid :file-list="listing.files"></ThumbnailFileGrid>
            </div>
        </main>
        <component v-for="[k, cmp] of Dialogs.iterator.value" :is="cmp" :key="k"></component>
        <UploadDropOverlay
            v-if="dropPreview.enabled.value"
            @hide="dropPreview.enabled.value = false"
            subtitle="Dropping files will open a view"></UploadDropOverlay>
    </div>
</template>
