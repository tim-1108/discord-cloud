<script setup lang="ts">
import { ref, useTemplateRef } from "vue";
import FileDropper from "../upload/FileDropper.vue";
import UploadRenderer from "../upload/UploadRenderer.vue";
import type { UploadFileHandle } from "@/composables/uploads";

function addFilesToList(additions: UploadFileHandle[]) {
    files.value.push(...additions);
    rendererEl.value?.buildFileTree();
}

const rendererEl = useTemplateRef("renderer");
const files = ref<UploadFileHandle[]>([]);
</script>

<template>
    <FileDropper @add="addFilesToList"></FileDropper>
    <UploadRenderer ref="renderer" v-if="files.length" :file-list="files"></UploadRenderer>
    <p v-else>No files!</p>
</template>
