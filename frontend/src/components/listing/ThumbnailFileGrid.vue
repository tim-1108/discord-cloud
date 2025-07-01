<script setup lang="ts">
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { getIconForFileType } from "@/composables/icons";
import type { ClientFileHandle } from "../../../../common/client";
import { Thumbnails } from "@/composables/thumbnail";
import { computed, reactive, ref, shallowReactive, toRaw, type ComputedRef, type Ref } from "vue";
import { faLock } from "@fortawesome/free-solid-svg-icons";

defineProps<{ fileList: ClientFileHandle[] }>();
const emit = defineEmits<{ select: [name: string] }>();

const thumbnailMap: Record<number, ComputedRef<string>> = shallowReactive({});

async function setThumbnail(entry: IntersectionObserverEntry, handle: ClientFileHandle) {
    if (!entry.isIntersecting || !handle.has_thumbnail) {
        return;
    }
    const ref = await Thumbnails.get(handle.id);
    if (!ref) {
        return;
    }
    thumbnailMap[handle.id] = computed(() => URL.createObjectURL(ref.value));
}
</script>

<template>
    <section id="file-grid" class="grid gap-2 grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        <button
            class="p-2 rounded-xl grid grid-rows-[1fr_150px] gap-1 text-start bg-[var(--component-color)] relative"
            v-for="handle of fileList"
            @click="emit('select', handle.name)">
            <div class="flex gap-1 items-center min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                <FontAwesomeIcon :icon="faLock" v-if="handle.ownership.status === 'restricted'"></FontAwesomeIcon>
                <span class="font-semibold">{{ handle.name }}</span>
            </div>
            <div class="bg-white rounded-xl grid place-content-center relative">
                <FontAwesomeIcon :icon="getIconForFileType(handle.name)" class="text-5xl" v-if="!thumbnailMap[handle.id]"></FontAwesomeIcon>
                <div
                    class="thumbnail opacity-0 rounded-xl h-full w-full absolute bg-cover bg-center"
                    v-else
                    :style="{ backgroundImage: `url('${thumbnailMap[handle.id].value}')` }"></div>
            </div>
            <div
                class="absolute h-full w-full top-0 left-0 pointer-events-none"
                v-if="handle.has_thumbnail"
                v-intersection-observer="[([entry]: IntersectionObserverEntry[]) => setThumbnail(entry, handle), { root: null }]"></div>
        </button>
    </section>
</template>

<style scoped>
.thumbnail {
    animation: fade-in forwards 500ms;
}
@keyframes fade-in {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}
</style>
