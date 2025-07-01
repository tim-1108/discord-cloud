<script setup lang="ts">
import { clearAuthentication } from "@/composables/authentication";
import { Dialogs } from "@/composables/dialog";
import { Uploads } from "@/composables/uploads";
import { faArrowRightFromBracket, faPlus } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { computed } from "vue";

function logOff() {
    clearAuthentication();
    location.reload();
}

const uploadCount = computed(() => Uploads.queue.count.value + Uploads.active.size);
</script>

<template>
    <aside class="px-4">
        <button
            class="p-4 bg-[var(--text-selected-color)] text-[var(--selected-color)] items-center flex gap-4 drop-shadow transition-all rounded-xl hover:shadow-lg hover:bg-[var(--text-selected-color-lighter)]"
            @click="Dialogs.mount('upload-submit', {})">
            <FontAwesomeIcon :icon="faPlus"></FontAwesomeIcon>
            <span>Upload</span>
        </button>
        <GrayHighlightButton @click="Dialogs.mount('uploads', {})" v-if="uploadCount >= 0" styling="default"
            >View {{ uploadCount }} upload{{ uploadCount > 1 ? "s" : "" }}</GrayHighlightButton
        >
        <GrayHighlightButton styling="default" @click="logOff" :icon="faArrowRightFromBracket">Log out</GrayHighlightButton>
    </aside>
</template>
