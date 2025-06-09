<script setup lang="ts">
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { faFolder, faFolderOpen } from "@fortawesome/free-solid-svg-icons";

defineProps<{ folderList: { name: string }[]; showUp: boolean }>();
const emit = defineEmits<{ navigateUp: []; navigate: [name: string] }>();
</script>

<template>
    <section id="folder-grid" class="grid gap-2 grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        <button
            class="px-4 py-3 rounded-xl grid grid-cols-[25px_1fr] text-start items-center gap-2 bg-[var(--component-color)]"
            v-if="showUp"
            @click="emit('navigateUp')">
            <FontAwesomeIcon class="text-xl" :icon="faFolderOpen"></FontAwesomeIcon>
            <span class="font-semibold">..</span>
        </button>
        <button
            class="px-4 py-3 rounded-xl grid grid-cols-[25px_1fr] text-start items-center gap-2 bg-[var(--component-color)]"
            v-for="handle of folderList"
            @click="emit('navigate', handle.name)">
            <FontAwesomeIcon class="text-xl" :icon="faFolder"></FontAwesomeIcon>
            <span class="font-semibold min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{{ handle.name }}</span>
        </button>
    </section>
</template>

<style scoped></style>
