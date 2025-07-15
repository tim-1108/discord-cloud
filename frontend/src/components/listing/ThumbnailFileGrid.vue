<script setup lang="ts">
import type { ClientFileHandle } from "../../../../common/client";
import { Thumbnails } from "@/composables/thumbnail";
import { computed, shallowReactive, type ComputedRef } from "vue";
import ThumbnailFile from "./ThumbnailFile.vue";

defineProps<{ fileList: ClientFileHandle[] }>();
const emit = defineEmits<{ select: [name: string] }>();

const thumbnailMap: Record<number, ComputedRef<string>> = shallowReactive({});

async function setThumbnail(handle: ClientFileHandle) {
    if (!handle.has_thumbnail) {
        return;
    }
    const ref = await Thumbnails.get(handle.id);
    if (!ref) {
        return;
    }
    // This is a computed ref to allow it to watch changes to the variable ref right here
    // whenever the thumbnail is updated (via a file-modify packet).
    thumbnailMap[handle.id] = computed(() => URL.createObjectURL(ref.value));
}
</script>

<template>
    <section id="file-grid" class="grid gap-2 grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        <ThumbnailFile
            v-for="handle of fileList"
            :handle="handle"
            :key="handle.name"
            :thumbnail="thumbnailMap[handle.id]"
            @visible="setThumbnail(handle)"
            @invisible=""></ThumbnailFile>
    </section>
</template>
