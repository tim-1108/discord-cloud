<script setup lang="ts">
import { Uploads, type UploadFileHandle } from "@/composables/uploads";
import BaseDialog from "./BaseDialog.vue";
import PathRenderer from "../PathRenderer.vue";
import StyledButton from "../basic/StyledButton.vue";
import FileDropper from "../upload/FileDropper.vue";
import { computed, ref } from "vue";
import UploadDropOverlay from "../overlay/UploadDropOverlay.vue";
import FolderGrid from "../listing/FolderGrid.vue";
import { convertRouteToPath } from "@/composables/path";
import FileGrid from "../listing/FileGrid.vue";
import { Dialogs } from "@/composables/dialog";

const isDropping = ref(false);
const isLocked = ref(false);

function addFilesViaInput(list: UploadFileHandle[]) {
    Uploads.preview.add(list);
}

const route = ref<string[]>([]);
const preview = computed(() => Uploads.preview.getForRoute(route.value));
const subfolders = computed(() => {
    if (!preview.value) {
        return null;
    }
    return Array.from(preview.value.subfolders.keys()).map((name) => ({ name }));
});
const files = computed(() => {
    if (!preview.value) {
        return null;
    }
    return Array.from(preview.value.files.keys()).map((name) => ({ name }));
});

function navigateUp() {
    if (!route.value.length) {
        return;
    }
    route.value.splice(route.value.length - 1, 1);
}

function navigateToSubfolder(name: string) {
    route.value.push(name);
}

async function requestClose() {
    if (Uploads.preview.count.value > 0) {
        const result = await Dialogs.confirm({ body: "Are you sure you wish to dismiss all uploads you have prepared?" });
        if (!result) {
            return;
        }
    }
    Uploads.preview.count.value = 0;
    Uploads.preview.reset();
    Dialogs.unmount("upload-submit");
}
</script>

<template>
    <BaseDialog class="w-[90%] h-[90%] min-w-0 relative" :class="{ 'overflow-hidden': isDropping }" @dragover="isDropping = true">
        <template v-slot:header>
            <div class="flex justify-between gap-4 flex-wrap items-center">
                <h1>Preparing your Upload</h1>
                <FileDropper
                    @preprocessing="isLocked = true"
                    @add="addFilesViaInput"
                    :hidden="true"
                    class="text-center bg-[var(--component-color)] rounded-full px-4 py-2 shadow cursor-pointer">
                    <span>Click to add files or drop anywhere</span>
                </FileDropper>
            </div>
        </template>
        <template v-slot:main>
            <div class="grid gap-2">
                <h3>Upload Target (does not have to exist yet)</h3>
                <PathRenderer class="shadow"></PathRenderer>
                <p>...{{ convertRouteToPath(route) }}</p>
                <template v-if="preview && subfolders && files">
                    <h3>Folders</h3>
                    <FolderGrid
                        v-if="route.length > 0 || subfolders.length"
                        :folder-list="subfolders"
                        :show-up="route.length > 0"
                        @navigate-up="navigateUp"
                        @navigate="navigateToSubfolder"></FolderGrid>
                    <span v-else><i>No subfolders</i></span>
                    <h3>Files</h3>
                    <FileGrid :file-list="files" v-if="files.length"></FileGrid>
                    <span v-else><i>No files at this location</i></span>
                </template>
            </div>
            <UploadDropOverlay v-if="isDropping" @hide="isDropping = false" subtitle="Dropping files will add them to this list"></UploadDropOverlay>
        </template>
        <template v-slot:footer>
            <div class="flex justify-end gap-2 py-4">
                <StyledButton color="critical" @click="requestClose">Abort</StyledButton>
                <StyledButton color="submit" :disabled="!Uploads.preview.count.value"
                    >Submit {{ Uploads.preview.count.value }} file{{ Uploads.preview.count.value === 1 ? "" : "s" }}</StyledButton
                >
            </div>
        </template>
    </BaseDialog>
</template>
