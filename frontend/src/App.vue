<script setup lang="ts">
import FileTable from "./components/FileTable.vue";
import PathRenderer from "./components/PathRenderer.vue";
import Sidebar from "./components/Sidebar.vue";
import StatusBox from "./components/StatusBox.vue";
import SubfolderTable from "./components/SubfolderTable.vue";
import { useCurrentFolderListing } from "./composables/listing";
</script>

<template>
    <div id="wrapper" class="min-h-0 max-h-screen">
        <PathRenderer></PathRenderer>
        <StatusBox></StatusBox>
        <div>
            <SubfolderTable></SubfolderTable>
            <FileTable></FileTable>
        </div>
        <Sidebar></Sidebar>
    </div>
</template>

<style lang="css">
#wrapper {
    @apply grid;
    grid-template-columns: 4fr 1fr;
    grid-template:
        "a b"
        "c d";
    > *:nth-child(1) {
        grid-area: "a";
    }
    > *:nth-child(2) {
        grid-area: "b";
    }
    > *:nth-child(3) {
        grid-area: "c";
    }
    > *:nth-child(4) {
        grid-area: "d";
    }
}
</style>
