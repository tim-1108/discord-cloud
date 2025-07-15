<script setup lang="ts">
import { faLock } from "@fortawesome/free-solid-svg-icons";
import type { ClientFileHandle } from "../../../../common/client";
import { getIconForFileType } from "@/composables/icons";
import { ref, type ComputedRef } from "vue";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";

defineProps<{ handle: ClientFileHandle; thumbnail?: ComputedRef<string> }>();
const emit = defineEmits<{
    select: [name: string];
    visible: [];
    invisible: [];
}>();

const wasIntersecting = ref(false);
function handleIntersection(entry: IntersectionObserverEntry) {
    // nothing changed
    if (wasIntersecting.value === entry.isIntersecting) return;

    // Typescript does not like this:
    // emit(entry.isIntersecting ? "visible" : "invisible");
    if (entry.isIntersecting) {
        emit("visible");
    } else {
        emit("invisible");
    }
}
</script>

<template>
    <button
        class="p-2 rounded-xl grid grid-rows-[1fr_150px] gap-1 text-start bg-[var(--component-color)] relative"
        @click="emit('select', handle.name)">
        <div class="flex gap-1 items-center min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
            <FontAwesomeIcon :icon="faLock" v-if="handle.ownership.status === 'restricted'"></FontAwesomeIcon>
            <span class="font-semibold">{{ handle.name }}</span>
        </div>
        <div class="bg-white rounded-xl grid place-content-center relative">
            <FontAwesomeIcon :icon="getIconForFileType(handle.name)" class="text-5xl" v-if="!thumbnail?.value"></FontAwesomeIcon>
            <div
                class="thumbnail opacity-0 rounded-xl h-full w-full absolute bg-cover bg-center"
                v-else
                :style="{ backgroundImage: `url('${thumbnail.value}')` }"></div>
        </div>
        <div
            class="absolute h-full w-full top-0 left-0 pointer-events-none"
            v-if="handle.has_thumbnail"
            v-intersection-observer="[([entry]: IntersectionObserverEntry[]) => handleIntersection(entry), { root: null }]"></div>
    </button>
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
