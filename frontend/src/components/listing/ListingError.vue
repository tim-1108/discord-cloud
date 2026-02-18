<script setup lang="ts">
import { faFolderPlus, faLongArrowUp, faRotateRight } from "@fortawesome/free-solid-svg-icons";

defineProps<{ path: string; message: string; canRetry?: boolean; canCreate?: boolean }>();
const emit = defineEmits<{ retry: []; createFolder: []; navigateUp: [] }>();
</script>

<template>
    <div class="grid h-full w-full place-content-center">
        <section class="bg-(--component-color) shadow rounded-xl py-2 px-4 grid justify-items-center gap-2">
            <h1 class="text-5xl!">:/</h1>
            <h3>An Error Occured</h3>
            <span>{{ message }}</span>
            <div class="grid md:flex gap-2">
                <HighlightButton :icon="faLongArrowUp" styling="default" v-if="path !== '/'" @click="emit('navigateUp')">Go Up</HighlightButton>
                <HighlightButton :icon="faRotateRight" styling="default" v-if="canRetry" @click="emit('retry')">Retry</HighlightButton>
                <HighlightButton :icon="faFolderPlus" styling="default" v-if="canCreate" @click="emit('createFolder')">Create</HighlightButton>
            </div>
        </section>
    </div>
</template>
