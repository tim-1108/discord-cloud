<script setup lang="ts">
import { ref, useTemplateRef } from "vue";
import FileDropper from "../upload/FileDropper.vue";
import StyledButton from "../basic/StyledButton.vue";
import UploadRenderer from "../upload/UploadRenderer.vue";
import { Uploads, type UploadFileHandle } from "@/composables/uploads";

function addFilesToList(additions: UploadFileHandle[]) {
    if (!rEl.value) {
        throw new ReferenceError("Failed to load upload renderer element");
    }
    for (const file of additions) {
        const flag = rEl.value.canAppendToTree(file.handle.name, file.relativePath);
        if (!flag) continue;
        files.value.push(file);
    }
    rEl.value?.buildFileTree();
}

const rEl = useTemplateRef("renderer");
const files = ref<UploadFileHandle[]>([]);

async function prepareUploads() {
    for (const handle of files.value) {
        // TODO: Do something with this, or, if the upload failed,
        //       show to user (warning dialog?)
        //       Also, filter out illegal characters before uploading
        //       In folder names and file names!
        const uploadId = await Uploads.submit(handle);
    }
}
</script>

<template>
    <p>Files will be uploaded to this absolute path</p>
    <FileDropper @add="addFilesToList"></FileDropper>
    <UploadRenderer ref="renderer" :file-list="files" @clear="files.length = 0"></UploadRenderer>
    <StyledButton color="warning" :disabled="!files.length" @click="prepareUploads">Upload Files</StyledButton>
</template>
