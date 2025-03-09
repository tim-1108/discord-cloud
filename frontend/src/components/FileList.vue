<script setup lang="ts">
import { currentFolderListing } from "@/composables/listing";
import { parseFileSize } from "../../../common/useless";
import { appendToRoute, navigateToAbsoluteRoute, useCurrentRoute } from "@/composables/path";
import ClickableCard from "./basic/ClickableCard.vue";

const listing = currentFolderListing;
const route = useCurrentRoute();
</script>

<template>
    <div v-if="typeof listing !== 'string'">
        <h1>Folders ({{ listing.folders.length }})</h1>
        <div class="file-list">
            <ClickableCard v-for="folder of listing.folders" @click="appendToRoute([folder.name])">
                <span class="font-bold">
                    {{ folder.name }}
                </span>
            </ClickableCard>
        </div>
        <h1>Files ({{ listing.files.length }})</h1>
        <div class="file-list">
            <ClickableCard v-for="file of listing.files"> {{ file.name }} ({{ parseFileSize(file.size) }}) </ClickableCard>
        </div>
    </div>
    <div v-else>{{ listing }}</div>
</template>

<style scoped>
@import "tailwindcss";
.file-list {
    grid-template-columns: repeat(4, 1fr);
    @apply grid;
}
</style>
