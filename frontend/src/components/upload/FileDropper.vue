<script setup lang="ts">
import { traverseFileTree } from "@/composables/filesystem";
import type { UploadRelativeFileHandle } from "@/composables/uploads";
import { useTemplateRef } from "vue";

defineProps<{ disabled?: boolean; hidden?: boolean }>();

const emit = defineEmits<{
    add: [files: UploadRelativeFileHandle[]];
    preprocessing: [];
}>();

const inputEl = useTemplateRef("input");

function onInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    if (!target.files) return;
    emit("preprocessing");
    const addedFiles = Array.from(target.files).map((file) => ({ handle: file, relativePath: "/" }));
    emit("add", addedFiles);
    clearSavedFiles();
}

async function onFileDrop(event: DragEvent) {
    // In order to get the FileSystemEntry from all dropped files/folders,
    // we need to make sure the webkitGetAsEntry method exists on them.
    // This DOES NOT exist on Firefox for Android
    // (where you cannot even drop anything - it is mobile after all)
    // https://developer.mozilla.org/en-US/docs/Web/API/DataTransferItem/webkitGetAsEntry
    // The function may end up being renamed to getAsEntry...
    // @ts-expect-error
    const fn: () => FileSystemEntry | null = DataTransferItem.prototype.getAsEntry ?? DataTransferItem.prototype.webkitGetAsEntry;
    if (!fn || !event.dataTransfer) return;
    emit("preprocessing");
    const { items } = event.dataTransfer;
    const filesAndFolders = Array.from(items)
        .map((entry) => fn.apply(entry))
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
    <div @click="inputEl?.click()" @drop.prevent.capture="onFileDrop" @dragover.prevent="">
        <slot></slot>
        <input
            class="pointer-events-none"
            :class="{ hidden: hidden }"
            ref="input"
            type="file"
            :disabled="disabled"
            multiple
            @change="onInputChange" />
    </div>
</template>
