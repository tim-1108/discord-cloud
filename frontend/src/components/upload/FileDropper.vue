<script setup lang="ts">
import { traverseFileTree } from "@/composables/filesystem";
import type { UploadFileHandle } from "@/composables/uploads";
import { useTemplateRef } from "vue";

const emit = defineEmits<{
    add: [files: UploadFileHandle[]];
}>();

const inputEl = useTemplateRef("input");

function onInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    if (!target.files) return;
    const addedFiles = Array.from(target.files).map((file) => ({ handle: file, relativePath: "/" }));
    emit("add", addedFiles);
    clearSavedFiles();
}

async function onFileDrop(event: DragEvent) {
    // In order to get the FileSystemEntry from all dropped files/folders,
    // we need to make sure the webkitGetAsEntry method exists on them.
    // This DOES NOT exist on Firefox for Android
    // (where you cannot even drop anything - it is mobile after all)
    if (!DataTransferItem.prototype.webkitGetAsEntry) return;
    if (!event.dataTransfer) return;
    const { items } = event.dataTransfer;
    const filesAndFolders = Array.from(items)
        .map((entry) => DataTransferItem.prototype.webkitGetAsEntry.apply(entry))
        .filter((entry) => entry !== null);
    const promises = await Promise.allSettled(filesAndFolders.map((ff) => traverseFileTree(ff)));
    const droppedFiles = promises.filter((result) => result.status === "fulfilled").flatMap((result) => result.value);
    emit("add", droppedFiles);
    clearSavedFiles();
}

function clearSavedFiles() {
    if (!inputEl.value) return;
    inputEl.value.files = null;
}
</script>

<template>
    <div @click="inputEl?.click()" @drop.prevent="onFileDrop" @dragover.prevent="">
        <p>Drop any files or folders here</p>
        <input class="pointer-events-none" ref="input" type="file" multiple @change="onInputChange" />
    </div>
</template>
