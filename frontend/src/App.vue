<script setup lang="ts">
import FileTable from "./components/FileTable.vue";
import PathRenderer from "./components/PathRenderer.vue";
import Sidebar from "./components/Sidebar.vue";
import StatusBox from "./components/StatusBox.vue";
import SubfolderTable from "./components/SubfolderTable.vue";
import ImagePreview from "./components/ImagePreview.vue";
import { getPreviewingImage } from "./composables/images";
import { globals } from "./composables/globals";

const listing = globals.listing.active;

const previewImage = getPreviewingImage();
</script>

<template>
    <div id="wrapper" class="min-h-0 max-h-screen gap-4">
        <PathRenderer></PathRenderer>
        <StatusBox></StatusBox>
        <div v-if="listing !== null">
            <SubfolderTable :listing="listing"></SubfolderTable>
            <FileTable :listing="listing"></FileTable>
        </div>
        <p v-else>Loading!</p>
        <Sidebar></Sidebar>
        <ImagePreview v-if="previewImage !== null"></ImagePreview>
    </div>
</template>

<style lang="css">
#wrapper {
    @apply grid;
    grid-template-columns:
        4fr
        minmax(300px, 500px);
}
</style>
