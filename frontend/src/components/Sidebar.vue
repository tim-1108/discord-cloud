<script setup lang="ts">
import { clearAuthentication } from "@/composables/authentication";
import { Dialogs } from "@/composables/dialog";
import { useListingMetadata } from "@/composables/listing_uncached";
import { Uploads } from "@/composables/uploads";
import { faArrowRightFromBracket, faFolderPlus, faPlus } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { computed } from "vue";

function logOff() {
    clearAuthentication();
    window.location.reload();
}

const uploadCount = computed(() => Uploads.queue.length + Uploads.active.size);
const listingMetadata = useListingMetadata();
</script>

<template>
    <aside class="px-4">
        <div class="flex flex-wrap">
            <ThemedButton color="blueish" padding="default"><FontAwesomeIcon :icon="faPlus"></FontAwesomeIcon></ThemedButton>
            <ThemedButton color="blueish" padding="default"><FontAwesomeIcon :icon="faFolderPlus"></FontAwesomeIcon></ThemedButton>
        </div>
        <GrayHighlightButton @click="Dialogs.mount('uploads', {})" v-if="uploadCount >= 0" styling="default"
            >View {{ uploadCount }} upload{{ uploadCount === 1 ? "" : "s" }}</GrayHighlightButton
        >
        <GrayHighlightButton styling="default" @click="logOff" :icon="faArrowRightFromBracket">Log out</GrayHighlightButton>
        <SidebarSizeChart v-if="listingMetadata" :folder-id="listingMetadata.folder_id"></SidebarSizeChart>
    </aside>
</template>
