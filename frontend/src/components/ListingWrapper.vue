<script setup lang="ts">
import { UncachedListing, type ListingError, type ListingMetadata } from "@/composables/listing_uncached";
import { computed, onMounted, ref, watch, type Ref } from "vue";
import type { ClientFileHandle, ClientFolderHandle } from "../../../common/client";
import { appendToRoute, navigateToParentFolder } from "@/composables/path";

const { path } = defineProps<{ path: string }>();

const metadata = ref<ListingMetadata | null>(null);
const sPageCount = computed(() => (metadata.value ? Math.ceil(metadata.value.subfolder_count / metadata.value.page_size) : null));
const fPageCount = computed(() => (metadata.value ? Math.ceil(metadata.value.file_count / metadata.value.page_size) : null));

const listingType = ref<"grid" | "table">("table");

type NamedMap<T extends { name: string }> = Map<string, T>;

const error = ref<ListingError | null>(null);
const files = ref<NamedMap<ClientFileHandle> | ListingError | null>(null);
const subfolders = ref<NamedMap<ClientFolderHandle> | ListingError | null>(null);

async function init() {
    const meta = await UncachedListing.init(path);
    if (!meta.data) {
        metadata.value = null;
        error.value = meta.error;
        return;
    }
    console.log(meta.data);
    metadata.value = meta.data;
    const $files = await UncachedListing.getPage(path, "files", 0);
    const $subfolders = await UncachedListing.getPage(path, "subfolders", 0);
    files.value = $files.data ?? $files.error;
    subfolders.value = $subfolders.data ?? $subfolders.error;
}

async function navigateToPage(type: "files" | "subfolders", page: number) {
    const res = await UncachedListing.getPage(path, type, page);
    if (type === "files") files.value = (res.data as NamedMap<ClientFileHandle>) ?? res.error;
    else subfolders.value = (res.data as NamedMap<ClientFolderHandle>) ?? res.error;
}

onMounted(init);
</script>

<template>
    <div class="grid h-full w-full place-content-center" v-if="!metadata && !error">
        <p>Loading...</p>
    </div>
    <ListingError v-else-if="error" :message="error.message" :can-create="error.can_create" :can-retry="error.can_retry" :path="path"></ListingError>
    <div class="flex justify-between items-end gap-4 flex-wrap" v-else>
        <h3>Folders</h3>
        <ListingTypeChooser :default-value="listingType" @update="(val) => (listingType = val)"></ListingTypeChooser>
    </div>
    <template v-if="subfolders instanceof Map">
        <FolderGrid
            v-if="listingType === 'grid'"
            :folder-list="Array.from(subfolders.values())"
            :show-up="path !== '/'"
            @navigate="(name) => appendToRoute([name])"
            @navigate-up="navigateToParentFolder"></FolderGrid>
        <FolderTable v-else :folder-list="Array.from(subfolders.values())"></FolderTable>
    </template>
    <h3>Files</h3>
    <template v-if="files instanceof Map">
        <ThumbnailFileGrid v-if="listingType === 'grid'" :file-list="Array.from(files.values())"></ThumbnailFileGrid>
        <FileTable v-else :file-list="Array.from(files.values())"></FileTable>
        <Pagination :page-count="fPageCount ?? 0" @navigate="(page) => navigateToPage('files', page)"></Pagination>
    </template>
</template>
