<script setup lang="ts">
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import FileDropper from "../upload/FileDropper.vue";
import { Dialogs } from "@/composables/dialog";
import { ref } from "vue";

const emit = defineEmits<{ hide: [] }>();
defineProps<{ subtitle: string }>();
const isProcessing = ref(false);

function done() {
    isProcessing.value = true;
    Dialogs.mount("upload-submit", {});
    emit("hide");
}
</script>

<template>
    <div class="grid place-content-center-safe h-full w-full absolute top-0 left-0 bg-black/80 pointer-events-none text-white/50 z-50">
        <div
            class="border-dashed border-4 border-white/50 p-20 rounded-3xl grid place-content-center gap-4 justify-items-center"
            v-if="!isProcessing">
            <FontAwesomeIcon class="text-5xl" :icon="faPlus"></FontAwesomeIcon>
            <h1>Drop files and folders</h1>
            <span>{{ subtitle }}</span>
        </div>
        <p v-else>Please be patient whilst your files are being processed.<br />Depending on the file count, this may take some time.</p>
    </div>
    <!-- The file dropper component is a utility that can be used (either visible or hidden) to capture files  -->
    <FileDropper
        :disabled="isProcessing"
        class="fixed top-0 left-0 h-screen w-screen z-50 opacity-0"
        @processing="isProcessing = true"
        @done="done"
        @dragleave.prevent="emit('hide')"
        @dragend.prevent="emit('hide')"></FileDropper>
</template>
