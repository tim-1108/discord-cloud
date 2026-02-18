<script setup lang="ts">
import { useListingRoute, navigateToAbsolutePath, navigateUpPath } from "@/composables/path";
import { ref } from "vue";
import ThemedButton from "./theme/ThemedButton.vue";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { faPen } from "@fortawesome/free-solid-svg-icons";

const route = useListingRoute();
const isEditing = ref(false);
</script>

<template>
    <div v-if="!isEditing" class="flex font-bold">
        <ThemedButton :selected="route.length === 0" @click="navigateToAbsolutePath('/')">~</ThemedButton>
        <ThemedButton
            class="whitespace-nowrap"
            v-for="(name, index) of route"
            :selected="index === route.length - 1"
            padding="small"
            @click="navigateUpPath(index)"
            >{{ name }}</ThemedButton
        >
        <ThemedButton padding="small"><FontAwesomeIcon :icon="faPen"></FontAwesomeIcon></ThemedButton>
    </div>
</template>
