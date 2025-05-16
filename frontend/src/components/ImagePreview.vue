<template>
    <div class="fixed h-screen w-screen bg-black grid place-content-center top-0 left-0">
        <img class="min-w-0 min-h-0" :src="imageUrl" v-if="imageUrl !== null" />
        <p v-else>No image selected</p>
    </div>
</template>

<script setup lang="ts">
import { getPreviewingImage } from "@/composables/images";
import { onBeforeUnmount, onMounted } from "vue";

const imageUrl = getPreviewingImage();

onMounted(() => {
    window.addEventListener("keydown", keydownEvent);
});
onBeforeUnmount(() => {
    window.removeEventListener("keydown", keydownEvent);
});

function keydownEvent(event: KeyboardEvent) {
    if (event.key !== "Escape") return;
    imageUrl.value = null;
}
</script>

<style scoped>
img {
    max-height: 100vh;
    max-width: 100vw;
}
</style>
