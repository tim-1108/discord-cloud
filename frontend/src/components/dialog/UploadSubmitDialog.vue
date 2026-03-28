<script setup lang="ts">
import { Uploads } from "@/composables/uploads";
import { computed, ref } from "vue";
import { convertRouteToPath } from "@/composables/path";
import { Dialogs } from "@/composables/dialog";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { UploadFileSystem } from "@/composables/filesystem";

const isDropping = ref(false);
const isLocked = ref(false);

const route = UploadFileSystem.relativeRoute.route;
const preview = computed(() => UploadFileSystem.getRoute(route.value));
const subfolders = computed(() => {
    return preview.value?.subfolders;
});
const files = computed(() => {
    return preview.value?.files ?? null;
});

async function requestClose() {
    if (UploadFileSystem.stem.fileCount > 0) {
        const result = await Dialogs.confirm({ body: "Are you sure you wish to dismiss all uploads you have prepared?" });
        if (!result) {
            return;
        }
    }
    UploadFileSystem.reset();
    UploadFileSystem.relativeRoute.navigateToRoot();
    Dialogs.unmount("upload-submit");
}

function submitPreviewedUploads() {
    UploadFileSystem.getArray().forEach(Uploads.submit);
    UploadFileSystem.reset();
    UploadFileSystem.relativeRoute.navigateToRoot();
    Dialogs.unmount("upload-submit");
}
</script>

<template>
    <BaseDialog class="w-[90%] h-[90%] min-w-0 relative" :class="{ 'overflow-hidden': isDropping }" @dragover="isDropping = true">
        <template v-slot:header>
            <div class="flex justify-between gap-4 flex-wrap items-center">
                <h1>Preparing your Upload</h1>
                <FileDropper
                    :base-route="route"
                    @processing="isLocked = true"
                    @done="isLocked = false"
                    :hidden="true"
                    class="text-center border-black/50 border-dashed border-2 rounded-full px-4 py-2 cursor-pointer hover:shadow-lg transition-shadow">
                    <div class="flex gap-2 items-center">
                        <FontAwesomeIcon :icon="faPlus"></FontAwesomeIcon>
                        <span>Click to add files or drop anywhere</span>
                    </div>
                </FileDropper>
            </div>
        </template>
        <template v-slot:main>
            <div class="grid gap-2">
                <p>...{{ convertRouteToPath(route) }}</p>
                <template v-if="preview && subfolders && files">
                    <h3>Folders ({{ subfolders.size }})</h3>
                    <FolderGrid
                        v-if="route.length > 0 || subfolders.size"
                        :folder-list="Array.from(subfolders.values())"
                        :show-up="route.length > 0"
                        @navigate-up="UploadFileSystem.relativeRoute.navigateUp"
                        @navigate="UploadFileSystem.relativeRoute.navigateToSubfolder"></FolderGrid>
                    <span v-else><i>No subfolders</i></span>
                    <h3>Files ({{ files.size }})</h3>
                    <FileGrid :file-list="Array.from(files.values())" v-if="files.size"></FileGrid>
                    <span v-else><i>No files at this location</i></span>
                </template>
            </div>
            <UploadDropOverlay v-if="isDropping" @hide="isDropping = false" subtitle="Dropping files will add them to this list"></UploadDropOverlay>
        </template>
        <template v-slot:footer>
            <div class="grid md:grid-cols-[1fr_max-content_max-content] grid-rows-3 md:grid-rows-1 gap-2 py-4">
                <PathRenderer class="shadow"></PathRenderer>
                <ThemedButton color="red" @click="requestClose">Abort</ThemedButton>
                <ThemedButton color="green" @click="submitPreviewedUploads" :disabled="UploadFileSystem.stem.fileCount === 0"
                    >Submit {{ UploadFileSystem.stem.fileCount }} file{{ UploadFileSystem.stem.fileCount === 1 ? "" : "s" }}</ThemedButton
                >
            </div>
        </template>
    </BaseDialog>
</template>
