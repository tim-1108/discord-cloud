<script setup lang="ts">
import { convertRouteToPath, navigateToAbsolutePath, navigateUpPath, useCurrentRoute } from "@/composables/path";
import BasicSection from "./basic/BasicSection.vue";
import HoverUnderlineText from "./basic/HoverUnderlineText.vue";
import { computed, ref, toRaw } from "vue";

const route = useCurrentRoute();
const path = computed(() => convertRouteToPath(route.value));
const updatedPath = ref<string>("");

function toggleEditing() {
    const mode = (isEditingModeActive.value = !isEditingModeActive.value);
    if (mode) {
        updatedPath.value = toRaw(path.value);
    } else {
        console.log(updatedPath.value);
        navigateToAbsolutePath(updatedPath.value);
    }
}

const isEditingModeActive = ref(false);
</script>

<template>
    <BasicSection class="flex gap-2 font-bold text-xl w-full">
        <template v-if="!isEditingModeActive">
            <HoverUnderlineText v-if="route.length" @click.capture="navigateToAbsolutePath('/')">~</HoverUnderlineText>
            <span v-else>~</span>
            <template v-for="(entry, index) of route">
                <span class="text-lg text-gray-400">/</span>
                <HoverUnderlineText v-if="index < route.length - 1" @click.capture="navigateUpPath(index)">{{ entry }}</HoverUnderlineText>
                <span v-else>{{ entry }}</span>
            </template>
            <button @click="toggleEditing">Edit</button>
        </template>
        <form v-else @submit.prevent="toggleEditing()">
            <input class="bg-emerald-700" v-model="updatedPath" />
        </form>
    </BasicSection>
</template>
