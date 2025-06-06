<script setup lang="ts">
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { getIconForFileType } from "@/composables/icons";

defineProps<{ fileList: { name: string }[] }>();
const emit = defineEmits<{ select: [name: string] }>();
</script>

<template>
    <section id="file-grid" class="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        <button
            class="px-4 py-3 rounded-xl grid grid-cols-[25px_1fr] text-start items-center gap-2 bg-[var(--component-color)]"
            v-for="handle of fileList"
            @click="emit('select', handle.name)">
            <FontAwesomeIcon class="text-xl" :icon="getIconForFileType(handle.name)"></FontAwesomeIcon>
            <span class="font-semibold min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{{ handle.name }}</span>
        </button>
    </section>
</template>

<style scoped></style>
