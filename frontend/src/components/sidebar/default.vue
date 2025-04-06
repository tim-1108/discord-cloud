<script setup lang="ts">
import { useSidebarState } from "@/composables/sidebar";

const state = useSidebarState();
</script>

<template>
    <p>Welcome!</p>
    <button @click="state = 'upload'">Goto uploads</button>
</template>
