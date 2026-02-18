<script setup lang="ts">
import { SortingFieldOptions, type Sort } from "@/composables/listing_uncached";
import type { ClientFileHandle, ClientFolderHandle } from "../../../../common/client";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { computed, onMounted, reactive, ref, useTemplateRef } from "vue";
import { useListingPath, useListingRoute } from "@/composables/path";
import { getIconForFileType } from "@/composables/icons";
import { formatByteString, parseDateObjectToRelative } from "../../../../common/useless";
import { logError } from "../../../../common/logging";
import { createSignedDownloadLink } from "@/composables/download";

const props = defineProps<{
    files: ClientFileHandle[];
    subfolders: ClientFolderHandle[];
    /* locks all sorting functions */
    locked: boolean;
    /**
     * Whether loading a next segment is even possible.
     */
    hasNext: boolean;
}>();
const emit = defineEmits<{
    // When a folder is clicked upon
    folder: [handle: ClientFolderHandle];
    down: [name: string];
    up: [];
    openFile: [handle: ClientFileHandle];
    // Updating the sort will cause the ListingWrapper to re-fetch the data
    // and thus will automatically update the props going into here. Nothing
    // needs to be emitted, as those values are stored in state.ts
    sort: [];
    loadNext: [];
}>();
const isInRoot = computed(() => useListingRoute().value.length === 0);

const target = useTemplateRef("observer");
const observeOptions = {
    // The body as a whole is scrolling
    root: null,
    rootMargin: "0px",
    threshold: 0
};
// ok, don't name this variable "observer",
// it will trigger problems in Vue.
const io = new IntersectionObserver(loadMoreContent, observeOptions);
onMounted(() => {
    if (!target.value) {
        // TODO: Add a fallback button within the container?
        logError("Failed to aquire intersection observer target for listing. Will not be able to auto-load more segments");
        return;
    }
    io.observe(target.value);
});

function loadMoreContent(entries: IntersectionObserverEntry[]) {
    if (!props.hasNext) return;
    for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        // As we are only observing this one object, if we get
        // a intersection once, that is all we care about.
        emit("loadNext");
        break;
    }
}

function canReadFile(handle: ClientFileHandle | ClientFolderHandle): boolean {
    return "ownership" in handle && handle.ownership.status !== "restricted";
}

function openFile(handle: ClientFileHandle) {
    if (!canReadFile(handle)) return;
    emit("openFile", handle);
}

// === Click and double click handling ===

const selectedFiles = reactive(new Set<number>());
const selectedFolders = reactive(new Set<number>());
const hasSelected = computed(() => selectedFiles.size > 0 || selectedFolders.size > 0);
const lastSelection = ref<{ type: "file" | "folder"; index: number } | null>(null);
/**
 * Mimics the selection mechanisms in Windows explorer.
 */
function handleClick(event: PointerEvent, type: "file" | "folder", index: number) {
    const set = type === "file" ? selectedFiles : selectedFolders;
    // we dont care about the alt key, that has no function here
    const hasNoModification = !event.ctrlKey && !event.shiftKey;
    if (hasNoModification) {
        selectedFiles.clear();
        selectedFolders.clear();
        // By clicking on it, only everything else is removed.
        // Just by clicking, an item can never be deselected.
        set.add(index);
        lastSelection.value = { type, index };
        return;
    }

    // The shift key takes priority when compared to the ctrl key.
    // If both would be pressed at the same time, it is the shift
    // that would be processed.
    if (event.ctrlKey && !event.shiftKey) {
        const has = set.has(index);
        has ? set.delete(index) : set.add(index);
        lastSelection.value = has ? null : { type, index };
        return;
    }

    // shift section

    if (!lastSelection.value) {
        set.add(index);
        lastSelection.value = { type, index };
        return;
    }

    const lastIndex = lastSelection.value.index;
    const lastType = lastSelection.value.type;
    const folderCount = props.subfolders.length;
    const has = set.has(index);
    const lastSet = lastType === "file" ? selectedFiles : selectedFolders;

    // easy part, just fill up
    if (lastSelection.value.type === type) {
        const min = Math.min(lastIndex, index);
        const max = Math.max(lastIndex, index);
        // This is a behaviour of "going-back". This means:
        // - user has selected a element above
        // - then selects one far below with shift
        // => all inbetween are selected
        // - then user selects something above the first one
        // => everything of the previous selection should be inverted

        // This basically checks: ok the selection group is above me, and
        // the user just selected something above me, so I should turn off
        if ((hasNeighbourBelow(type, lastIndex) && index > lastIndex) || (hasNeighbourAbove(type, lastIndex) && index < lastIndex)) {
            set.delete(lastIndex);
        } else {
            has ? set.delete(lastIndex) : set.add(lastIndex);
        }
        for (let i = min + 1; i < max; i++) {
            set.has(i) ? set.delete(i) : set.add(i);
        }
        set.add(index);
    } else {
        // This is essentially the same code as above, but with the
        // consideration that we have to read from both Sets

        const below = hasNeighbourBelow(lastType, lastIndex) && type === "file";
        const above = hasNeighbourAbove(lastType, lastIndex) && type === "folder";
        if (below || above) {
            lastSet.delete(lastIndex);
        } else {
            has ? lastSet.delete(lastIndex) : lastSet.add(lastIndex);
        }

        // These are ranges, start inclusive, end exclusive
        // lastIndex is treated differently. It should not be included
        // in these ranges as it is handled above already.
        const folders = [lastType === "folder" ? lastIndex + 1 : index, folderCount];
        const files = [0, lastType === "file" ? lastIndex : index + 1];
        for (let i = folders[0]; i < folders[1]; i++) {
            selectedFolders.has(i) ? selectedFolders.delete(i) : selectedFolders.add(i);
        }
        for (let i = files[0]; i < files[1]; i++) {
            selectedFiles.has(i) ? selectedFiles.delete(i) : selectedFiles.add(i);
        }
        set.add(index);
    }

    lastSelection.value = { type, index };
}

function clearSelection() {
    selectedFiles.clear();
    selectedFolders.clear();
}

function hasNeighbourAbove(type: "file" | "folder", index: number): boolean {
    const set = type === "file" ? selectedFiles : selectedFolders;
    const other = type === "file" ? selectedFolders : selectedFiles;
    const folderTotal = props.subfolders.length;
    if (type === "folder" && index === 0) return false;
    if (type === "file" && index === 0) {
        return other.has(folderTotal - 1);
    }
    return set.has(index - 1);
}

function hasNeighbourBelow(type: "file" | "folder", index: number): boolean {
    const set = type === "file" ? selectedFiles : selectedFolders;
    const other = type === "file" ? selectedFolders : selectedFiles;
    const folderTotal = props.subfolders.length;
    const fileTotal = props.files.length;
    if (type === "file" && index === fileTotal - 1) return false;
    if (type === "folder" && index === folderTotal - 1) {
        return other.has(0);
    }
    return set.has(index + 1);
}

function handleDoubleClick<T extends "file" | "folder">(
    event: MouseEvent,
    type: T,
    handle: T extends "file" ? ClientFileHandle : ClientFolderHandle
) {
    // Nothing to do here, we will handle this in the
    // default click handler, just as if it has not been
    // pressed double.
    if (event.shiftKey || event.ctrlKey) return;
    if (type === "file" && !canReadFile(handle)) return;
    type === "file" ? emit("openFile", handle as ClientFileHandle) : emit("down", handle.name);
}

async function createSignedDownloadLink_Wrapper(index: number) {
    const handle = props.files[index];
    if (!handle) return;
    const link = await createSignedDownloadLink(useListingPath().value, handle.name);
    if (!link) return;
    navigator.clipboard.writeText(link.toString());
}
</script>

<template>
    <main class="grid gap-x-1 relative">
        <header class="row-start-1 row-end-1 select-none" v-if="!hasSelected">
            <div></div>
            <div class="grid place-content-center"><img src="@/assets/icons/page_facing_up_color.svg" class="h-6" /></div>
            <div v-for="item of SortingFieldOptions">
                <TableSorting :id="item.field" :display-name="item.name" @toggle="emit('sort')" :locked="locked"></TableSorting>
            </div>
            <div class="text-gray-500 flex items-center"><p>Status</p></div>
        </header>
        <SelectionInfo
            class="row-start-1 row-end-1 col-span-7 sticky top-0"
            :files="selectedFiles"
            :folders="selectedFolders"
            v-else
            @clear="clearSelection"
            @signed-download="createSignedDownloadLink_Wrapper"></SelectionInfo>
        <section id="parent-folder" v-if="!isInRoot" @click="emit('up')" class="hover:underline">
            <div></div>
            <div><img src="@/assets/icons/open_file_folder_color.svg" class="h-6" /></div>
            <div>..</div>
        </section>
        <section
            v-for="(handle, index) of subfolders"
            :key="handle.id"
            @click="(e) => handleClick(e, 'folder', index)"
            @dblclick="(e) => handleDoubleClick(e, 'folder', handle)"
            :class="{ selected: selectedFolders.has(index) }"
            :data-neighbour-above="hasNeighbourAbove('folder', index)"
            :data-neighbour-below="hasNeighbourBelow('folder', index)">
            <div></div>
            <div><img src="@/assets/icons/file_folder_color.svg" class="h-6" /></div>
            <div>
                <p class="hover:underline w-fit" @click="emit('down', handle.name)">{{ handle.name }}</p>
            </div>
        </section>
        <section
            v-for="(handle, index) of files"
            :key="handle.id"
            @click="(e) => handleClick(e, 'file', index)"
            @dblclick="(e) => handleDoubleClick(e, 'file', handle)"
            :class="{ 'cursor-not-allowed!': !canReadFile(handle), selected: selectedFiles.has(index) }"
            :data-neighbour-above="hasNeighbourAbove('file', index)"
            :data-neighbour-below="hasNeighbourBelow('file', index)">
            <div></div>
            <div><FontAwesomeIcon :icon="getIconForFileType(handle.name)" class="h-6"></FontAwesomeIcon></div>
            <div>
                <p class="w-fit" :class="{ 'hover:underline': canReadFile(handle) }" @click="openFile(handle)">{{ handle.name }}</p>
            </div>
            <div>{{ handle.updated_at ? parseDateObjectToRelative(new Date(handle.updated_at)) : "Unbekannt" }}</div>
            <div>{{ formatByteString(handle.size) }}</div>
            <div class="flex gap-2 items-center">
                <template v-if="handle.ownership.status === 'public'">
                    <img class="h-6" src="@/assets/icons/globe_with_meridians_color.svg" />
                    <p>Public</p>
                </template>
                <template v-else-if="handle.ownership.status === 'owned'">
                    <p>Owned</p>
                </template>
                <template v-else-if="handle.ownership.status === 'restricted'">
                    <img class="h-6" src="@/assets/icons/locked_color.svg" />
                    <p>Restricted</p>
                </template>
                <template v-else-if="handle.ownership.status === 'shared'">
                    <img class="h-6" src="@/assets/icons/link_color.svg" />
                    <p>Shared{{ handle.ownership.share.can_write ? "" : " (read-only)" }}</p>
                </template>
            </div>
        </section>
        <footer ref="observer" class="w-full grid justify-center col-start-1 col-end-7">
            <p v-if="!hasNext">No further items.</p>
        </footer>
    </main>
</template>

<style lang="css" scoped>
@import "tailwindcss";
main {
    grid-template-columns: repeat(2, 40px) 50% 10fr 4fr minmax(0, 200px);
}
header,
section {
    @apply grid grid-cols-subgrid col-start-1 col-end-7;
}
section.selected {
    @apply bg-[#e3efff] hover:bg-[#cce2ff];
}
section > div:nth-child(2) {
    @apply flex items-center justify-center;
}
section {
    @apply cursor-pointer items-center py-2 rounded-lg select-none;
}
section:not(.selected) {
    @apply hover:bg-[#f5f5f5];
}
section[data-neighbour-above="true"] {
    @apply rounded-t-none;
}
section[data-neighbour-below="true"] {
    @apply rounded-b-none;
}

p {
    @apply whitespace-nowrap min-w-0 overflow-ellipsis;
}
</style>
