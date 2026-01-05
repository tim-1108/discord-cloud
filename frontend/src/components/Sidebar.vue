<script setup lang="ts">
import { clearAuthentication } from "@/composables/authentication";
import { Dialogs } from "@/composables/dialog";
import { Uploads } from "@/composables/uploads";
import { faArrowRightFromBracket, faPlus } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { computed } from "vue";

function logOff() {
    clearAuthentication();
    window.location.reload();
}

const uploadCount = computed(() => Uploads.queue.length + Uploads.active.size);
const props = defineProps<{ folderId?: number | null }>();
</script>

<template>
    <aside class="px-4">
        <button
            class="p-4 bg-(--text-selected-color) text-(--selected-color) items-center flex gap-4 drop-shadow transition-all rounded-xl hover:shadow-lg hover:bg-(--text-selected-color-lighter)"
            @click="Dialogs.mount('upload-submit', {})">
            <FontAwesomeIcon :icon="faPlus"></FontAwesomeIcon>
            <span>Upload</span>
        </button>
        <GrayHighlightButton @click="Dialogs.mount('uploads', {})" v-if="uploadCount >= 0" styling="default"
            >View {{ uploadCount }} upload{{ uploadCount === 1 ? "" : "s" }}</GrayHighlightButton
        >
        <GrayHighlightButton styling="default" @click="logOff" :icon="faArrowRightFromBracket">Log out</GrayHighlightButton>
        <SidebarSizeChart :folder-id="props.folderId" v-if="props.folderId !== undefined"></SidebarSizeChart>
    </aside>
</template>
