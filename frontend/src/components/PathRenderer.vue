<script setup lang="ts">
import { convertRouteToPath, navigateToAbsolutePath, navigateUpPath, useCurrentRoute } from "@/composables/path";
import HoverUnderlineText from "./basic/HoverUnderlineText.vue";
import { computed, ref, toRaw } from "vue";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { faCheck, faPencil } from "@fortawesome/free-solid-svg-icons";

const route = useCurrentRoute();
const path = computed(() => convertRouteToPath(route.value));
const updatedPath = ref<string>("");

function toggleEditing() {
    const mode = (isEditing.value = !isEditing.value);
    if (mode) {
        updatedPath.value = toRaw(path.value);
    } else {
        navigateToAbsolutePath(updatedPath.value);
    }
}

const isEditing = ref(false);
</script>

<template>
    <section
        class="font-bold min-w-0 rounded-full h-14 py-2 px-4 relative transition-colors flex items-center"
        :data-editing="isEditing ? '' : null"
        :class="{ 'border-2 border-dashed border-[var(--text-selected-color)]': isEditing }">
        <div class="flex gap-2 text-3xl min-w-0 max-w-full h-full overflow-x-auto overflow-y-hidden items-center pr-10" v-if="!isEditing">
            <HoverUnderlineText v-if="route.length" @click.capture="navigateToAbsolutePath('/')">~</HoverUnderlineText>
            <span v-else>~</span>
            <template v-for="(entry, index) of route">
                <span class="text-xl text-gray-400">/</span>
                <HoverUnderlineText v-if="index < route.length - 1" @click.capture="navigateUpPath(index)" class="whitespace-nowrap">{{
                    entry
                }}</HoverUnderlineText>
                <span v-else class="whitespace-nowrap">{{ entry }}</span>
            </template>
        </div>
        <form v-else @submit.prevent="toggleEditing" class="w-full">
            <input v-model="updatedPath" class="w-full text-2xl h-full rounded-full absolute top-0 left-0 py-4 pl-6 pr-14" autofocus />
        </form>
        <button
            class="rounded-full grid place-content-center text-xl absolute right-2 shadow h-10 w-10 aspect-square bg-[var(--component-color)]"
            @click="toggleEditing">
            <FontAwesomeIcon :icon="isEditing ? faCheck : faPencil"></FontAwesomeIcon>
        </button>
    </section>
</template>

<style scoped>
section {
    background-color: var(--component-color);
}
section[data-editing] {
    background-color: var(--selected-color);
    color: var(--text-selected-color);
}
</style>
