<script setup lang="ts">
import { convertPathToRoute, convertRouteToPath } from "@/composables/path";
import type { UploadFileHandle } from "@/composables/uploads";
import { computed, onMounted, ref, watch } from "vue";

const { fileList: files } = defineProps<{ fileList: UploadFileHandle[] }>();
const emit = defineEmits<{ removeFile: [handle: UploadFileHandle]; removeFolder: [relativePath: string] }>();

type FileTreeEntry = { files: File[]; subfolders: string[]; subfolder_map: Map<string, FileTreeEntry> };
const createEmptyFileTreeEntry = () => ({ files: [], subfolders: [], subfolder_map: new Map() });

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
            pathMap.set(handle.relativePath, [handle.handle]);
            return handle;
        }
        pathMap.get(handle.relativePath)!.push(handle.handle);
    });
    // These could be sorted, this would need other optimizations to be useful.
    const routes = Array.from(pathMap.keys()).map((path) => ({ path, route: convertPathToRoute(path) }));
    routes.forEach(({ path, route }) => {
        const entry = getFileTreeEntry(route) as FileTreeEntry;
        const files = pathMap.get(path);
        if (!files) return;
        entry.files.push(...files);
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

function removeFile(route: string[], name: string): boolean {
    const treeEntry = getFileTreeEntry(route, false);
    if (!treeEntry) return false;
    const index = treeEntry.files.findIndex((handle) => handle.name === name);
    if (index === -1) return false;
    treeEntry.files.splice(index, 1);
    return true;
}

onMounted(() => {
    buildFileTree();
});

defineExpose({ buildFileTree });

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
    <div class="flex gap-2">
        <span @click="navigateToRoot">local root</span>
        <small v-if="!currentRoute.length">/</small>
        <template v-for="(item, index) of currentRoute">
            <small>/</small>
            <span @click="navigateUpRoute(index)">{{ item }}</span>
        </template>
    </div>
    <div v-if="currentEntry">
        <h1>Subfolders</h1>
        <div class="grid gap-1">
            <button v-for="name of currentEntry.subfolders" @click="navigateToSubfolder(name)">
                <span>{{ name }}</span>
            </button>
        </div>
        <h1>Files</h1>
        <div class="grid gap-1">
            <button class="flex gap-2 items-center justify-between" v-for="file of currentEntry.files">
                <span>{{ file.name }}</span>
                <small>{{ file.size }} bytes, {{ file.type || "unknown type" }}</small>
            </button>
        </div>
    </div>
    <p v-else>No current entry</p>
</template>
