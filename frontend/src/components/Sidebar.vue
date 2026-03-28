<script setup lang="ts">
import { Authentication } from "@/composables/authentication";
import { Dialogs } from "@/composables/dialog";
import { Uploads } from "@/composables/uploads";
import { faArrowRightFromBracket } from "@fortawesome/free-solid-svg-icons";
import { computed } from "vue";

function logOff() {
    Authentication.clear();
    window.location.reload();
}

const uploadCount = computed(() => Uploads.queue.length + Uploads.active.size);
</script>

<template>
    <aside class="px-4">
        <div class="flex flex-wrap"></div>
        <ThemedButton @click="Dialogs.mount('uploads', {})" v-if="uploadCount >= 0" color="default"
            >View {{ uploadCount }} upload{{ uploadCount === 1 ? "" : "s" }}</ThemedButton
        >
        <ThemedButton color="default" @click="logOff" :icon="faArrowRightFromBracket">Log out</ThemedButton>
    </aside>
</template>
