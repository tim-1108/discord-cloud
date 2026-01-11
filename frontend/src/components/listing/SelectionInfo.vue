<script setup lang="ts">
import { faClose, faLongArrowDown, faShare, faUser } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { computed } from "vue";

const props = defineProps<{ folders: Set<number>; files: Set<number> }>();
const emit = defineEmits<{ clear: []; signedDownload: [fileId: number] }>();
const totalCount = computed(() => props.files.size + props.folders.size);

function emitSignedDownloads() {
    for (const id of props.files) {
        emit("signedDownload", id);
    }
}

const buttons = [
    { icon: faLongArrowDown, text: "Download" },
    { icon: faShare, text: "Share link", show: computed(() => props.folders.size === 0 && props.files.size === 1), onClick: emitSignedDownloads },
    { icon: faUser, text: "Share with users" }
];
</script>

<template>
    <aside class="bg-blue-500 text-white rounded-lg drop-shadow-xl w-full h-10 flex items-center px-2 gap-4">
        <button
            class="rounded-full border-2 border-white flex gap-2 flex-wrap items-center px-4 py-1 text-xs hover:bg-white/20"
            @click="emit('clear')">
            <FontAwesomeIcon :icon="faClose"></FontAwesomeIcon>
            <span>Clear {{ totalCount }} item{{ totalCount === 1 ? "" : "s" }}</span>
        </button>
        <template v-for="button of buttons">
            <button
                v-if="button.show?.value ?? true"
                class="aspect-square rounded-full px-2 hover:bg-white/20"
                @click="button.onClick ? button.onClick() : null"
                :aria-details="button.text">
                <FontAwesomeIcon :icon="button.icon"></FontAwesomeIcon>
            </button>
        </template>
    </aside>
</template>
