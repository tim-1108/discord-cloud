<script setup lang="ts">
import PathRenderer from "../components/PathRenderer.vue";
import UploadDropOverlay from "../components/overlay/UploadDropOverlay.vue";
import { computed, onMounted, ref, watch } from "vue";
import { Dialogs } from "../composables/dialog";
import { convertPathToRoute, convertRouteToPath, useListingRoute } from "../composables/path";
import Sidebar from "../components/Sidebar.vue";
import { Connection } from ".././composables/connection";
import { PendingAuthenticationState } from "../composables/state";
import { UncachedListing, useListingMetadata, type ListingError, type ListingMetadata } from ".././composables/listing_uncached";
import { logWarn } from "../../../common/logging";
import { useRoute } from "vue-router";
import { useFlyoutVnode } from "@/composables/flyout";

const route = useListingRoute();
const path = computed(() => convertRouteToPath(route.value));

const dropPreview = {
    enabled: ref(false),
    show: (ev: DragEvent) => {
        if (!dropPreview.isAnyFileAttached(ev.dataTransfer) || Dialogs.iterator.value.size) return;
        dropPreview.enabled.value = true;
    },
    hide: (ev: DragEvent) => {
        dropPreview.enabled.value = false;
    },
    isAnyFileAttached(dt: DataTransfer | null) {
        if (!dt) {
            return false;
        }
        return Array.from(dt.items).every(({ kind }) => kind === "file");
    }
};

const isConnected = Connection.isConnected;
const flyout = useFlyoutVnode();

onMounted(() => {
    const defaultRoute = useRoute();
    route.value = convertPathToRoute(decodeURIComponent(defaultRoute.path));
});
</script>

<template>
    <div
        class="grid grid-rows-[75px_1fr] not-md:grid-cols-[1fr] md:grid-cols-[250px_1fr] h-screen relative z-50"
        @dragover.prevent="dropPreview.show"
        @drop.prevent="">
        <header class="row-span-1 col-span-2 grid md:grid-cols-[250px_1fr] items-center">
            <div class="not-md:hidden px-4">
                <img class="h-full min-h-0 w-20" src="../assets/logo.png" />
            </div>
            <div class="flex justify-between gap-16">
                <PathRendererNew class="w-full max-w-full min-w-0 overflow-x-hidden"></PathRendererNew>
                <StatusBar class="not-md:hidden"></StatusBar>
            </div>
        </header>

        <Sidebar class="not-md:hidden row-span-1 overflow-auto"></Sidebar>
        <main class="row-span-1 overflow-auto md:p-4 bg-white md:rounded-tl-3xl min-h-0 not-md:pb-28">
            <div v-if="!isConnected">
                <span v-if="PendingAuthenticationState === 'health'">Waiting for server to come online</span>
                <span v-else-if="PendingAuthenticationState === 'login'">Logging in</span>
                <span v-else-if="PendingAuthenticationState === 'pending'">Waiting for credentials</span>
                <span v-else-if="PendingAuthenticationState === 'establishing'">Establishing connection</span>
                <span v-else-if="PendingAuthenticationState === 'established'">Connected</span>
            </div>
            <ListingWrapper v-if="isConnected" :path="path" :key="path"></ListingWrapper>
        </main>
        <footer class="fixed w-screen h-20 py-2 bottom-0 left-0 md:hidden flex justify-center bg-white drop-shadow border-t border-(--border-color)">
            <StatusBar></StatusBar>
        </footer>
        <component v-for="[k, cmp] of Dialogs.iterator.value" :is="cmp" :key="k"></component>
        <component v-if="flyout" :is="flyout"></component>
        <NotificationWrapper></NotificationWrapper>
        <UploadDropOverlay
            v-if="dropPreview.enabled.value"
            @hide="dropPreview.enabled.value = false"
            subtitle="Dropping files will open a view"></UploadDropOverlay>
    </div>
</template>
