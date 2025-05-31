<script setup lang="ts">
import { faFolder, faFolderOpen } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
defineProps<{ folderList: string[]; displayUp?: boolean }>();
const emit = defineEmits<{ navigate: [name: string]; "navigate-up": [] }>();
</script>

<template>
    <div class="flex gap-2 flex-wrap">
        <div class="button" @click="emit('navigate-up')" v-if="displayUp">
            <FontAwesomeIcon :icon="faFolderOpen"></FontAwesomeIcon>
            <span>..</span>
        </div>
        <div class="button" v-for="name of folderList" @click="emit('navigate', name)">
            <FontAwesomeIcon :icon="faFolder"></FontAwesomeIcon>
            <span>{{ name }}</span>
        </div>
    </div>
</template>

<style scoped>
@import "tailwindcss";
.button {
    @apply cursor-pointer border-2 py-2 px-3 gap-1 border-white flex items-center rounded-lg;
}
</style>
