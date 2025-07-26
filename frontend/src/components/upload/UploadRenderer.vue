<script setup lang="ts">
import { convertPathToRoute, convertRouteToPath } from "@/composables/path";
import type { UploadRelativeFileHandle } from "@/composables/uploads";
import { computed, onMounted, ref, watch } from "vue";
import SubfolderList from "../SubfolderList.vue";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { getIconForFileType } from "@/composables/icons";

const { fileList: files } = defineProps<{ fileList: UploadRelativeFileHandle[] }>();
const emit = defineEmits<{ removeFile: [handle: UploadRelativeFileHandle]; removeFolder: [relativePath: string]; clear: [] }>();

type FileTreeEntry = { files: Map<string, File>; subfolders: string[]; subfolder_map: Map<string, FileTreeEntry> };
const createEmptyFileTreeEntry = () => ({ files: new Map(), subfolders: [], subfolder_map: new Map() });

/**
 * @returns Whether the file can be added to the list
 */
function canAppendToTree(name: string, path: string): boolean {
    const route = convertPathToRoute(path);
    const entry = getFileTreeEntry(route, false);
    if (entry === null) {
        return true;
    }
    return !entry.files.has(name);
}

const fileTree: FileTreeEntry = createEmptyFileTreeEntry();
/**
 * Adds the passed files to the tree.
 * @param files An array of the files to add (either initial or newcomers)
 */
function buildFileTree() {
    if (!files.length) return;
    // To be strategic with our sorting and adding to the file tree,
    // it is optimal to find all files which are part of a directory
    // and create already a small table.
    const pathMap = new Map<string, File[]>();
    files.forEach((handle) => {
        if (!pathMap.has(handle.relativePath)) {
            pathMap.set(handle.relativePath, [handle.file]);
            return handle;
        }
        pathMap.get(handle.relativePath)!.push(handle.file);
    });
    // These could be sorted, this would need other optimizations to be useful.
    const routes = Array.from(pathMap.keys()).map((path) => ({ path, route: convertPathToRoute(path) }));
    routes.forEach(({ path, route }) => {
        const entry = getFileTreeEntry(route) as FileTreeEntry;
        const files = pathMap.get(path);
        if (!files) return;
        files.forEach((value) => entry.files.set(value.name, value));
    });
    recomputeCurrentEntry(currentRoute.value);
}

function getFileTreeEntry(route: string[], createAlongPath: boolean = true): FileTreeEntry | null {
    let parent = fileTree;
    for (let i = 0; i < route.length; i++) {
        const name = route[i];
        let child = parent.subfolder_map.get(name);
        if (!child) {
            if (!createAlongPath) return null;

            child = createEmptyFileTreeEntry();
            parent.subfolder_map.set(name, child);
            parent.subfolders.push(name);
        }
        parent = child;
    }
    return parent;
}

function deleteFile(route: string[], name: string): boolean {
    const treeEntry = getFileTreeEntry(route, false);
    if (!treeEntry) return false;
    return treeEntry.files.delete(name);
}

function clear() {
    fileTree.files = new Map();
    fileTree.subfolder_map = new Map();
    fileTree.subfolders = [];
    emit("clear");
}

onMounted(() => {
    buildFileTree();
});

defineExpose({ buildFileTree, canAppendToTree, clear, deleteFile });

const currentRoute = ref<string[]>([]);
const currentEntry = ref<FileTreeEntry | null>(null);

function recomputeCurrentEntry(route: string[]) {
    currentEntry.value = null;
    currentEntry.value = getFileTreeEntry(route, false);
}

watch(currentRoute, recomputeCurrentEntry);

function navigateUpRoute(newIndex: number) {
    if (newIndex >= currentRoute.value.length - 1) return;
    currentRoute.value = currentRoute.value.slice(0, newIndex + 1);
}
function navigateToSubfolder(name: string) {
    currentRoute.value = currentRoute.value.concat(name);
}
function navigateToRoot() {
    currentRoute.value = [];
}
</script>

<template>
    <h2 class="font-bold">Navigation</h2>
    <div class="flex gap-2 items-center">
        <span @click="navigateToRoot">...</span>
        <small v-if="!currentRoute.length">/</small>
        <template v-for="(item, index) of currentRoute">
            <small>/</small>
            <span class="bg-[var(--component-color)] px-2 py-1 rounded-full cursor-pointer" @click="navigateUpRoute(index)">{{ item }}</span>
        </template>
    </div>
    <div v-if="currentEntry" class="grid gap-1">
        <h2 class="font-bold">Folders</h2>
        <SubfolderList
            :folder-list="currentEntry.subfolders"
            @navigate="navigateToSubfolder"
            :display-up="!!currentRoute.length"
            @navigate-up="() => navigateUpRoute(currentRoute.length - 2)"></SubfolderList>
        <h2 class="font-bold">Files</h2>
        <div class="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            <div class="flex items-center gap-2" v-for="[name, handle] of currentEntry.files">
                <FontAwesomeIcon :icon="getIconForFileType(name)"></FontAwesomeIcon>
                <span>{{ name }}</span>
            </div>
        </div>
    </div>
    <p v-else>No current entry</p>
</template>
