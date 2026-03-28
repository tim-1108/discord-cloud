<script setup lang="ts">
import { UploadFileSystem } from "@/composables/filesystem";
import { useTemplateRef } from "vue";

defineProps<{ disabled?: boolean; hidden?: boolean }>();

const emit = defineEmits<{
    processing: [];
    done: [];
}>();

const inputEl = useTemplateRef("input");

function onInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    if (!target.files) return;
    emit("processing");
    UploadFileSystem.appendFileList(target.files);
    emit("done");
    clearSavedFiles();
}

async function onFileDrop(event: DragEvent) {
    if (!event.dataTransfer) return;
    emit("processing");
    await UploadFileSystem.append(event.dataTransfer);
    emit("done");
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
