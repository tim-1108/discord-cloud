<script setup lang="ts">
import { clearAuthentication } from "@/composables/authentication";
import { Dialogs } from "@/composables/dialog";
import { Uploads } from "@/composables/uploads";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";

function logOff() {
    clearAuthentication();
    location.reload();
}
</script>

<template>
    <aside class="px-4">
        <button
            class="p-4 bg-[var(--text-selected-color)] text-[var(--selected-color)] items-center flex gap-4 drop-shadow transition-all rounded-xl hover:shadow-lg hover:bg-[var(--text-selected-color-lighter)]"
            @click="Dialogs.mount('upload-submit', {})">
            <FontAwesomeIcon :icon="faPlus"></FontAwesomeIcon>
            <span>Upload</span>
        </button>
        <button @click="logOff">Log off</button>
        <p>{{ Uploads.queue.count.value }} uploads in queue</p>
    </aside>
</template>
