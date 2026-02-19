<script setup lang="ts">
import { faPlus, faFolderPlus, faChartColumn, faUpload, faSignal } from "@fortawesome/free-solid-svg-icons";
import { Dialogs } from "@/composables/dialog";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
</script>

<template>
    <div class="flex gap-8">
        <div class="flex">
            <StatusBarItem flyout-key="connection"> <FontAwesomeIcon :icon="faSignal"></FontAwesomeIcon></StatusBarItem>
            <StatusBarItem flyout-key="uploads"> <FontAwesomeIcon :icon="faUpload"></FontAwesomeIcon></StatusBarItem>
            <StatusBarItem flyout-key="properties"> <FontAwesomeIcon :icon="faChartColumn"></FontAwesomeIcon></StatusBarItem>
        </div>
        <div class="flex">
            <ThemedButton color="blueish" @click="Dialogs.mount('upload-submit', {})"
                ><FontAwesomeIcon :icon="faPlus"></FontAwesomeIcon
            ></ThemedButton>
            <ThemedButton color="blueish"><FontAwesomeIcon :icon="faFolderPlus"></FontAwesomeIcon></ThemedButton>
        </div>
    </div>
</template>
