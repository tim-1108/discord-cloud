<template>
    <div class="infinite-spinner" :style="{ '--size': size + 'px' }">
        <div></div>
    </div>
</template>

<script setup lang="ts">
defineProps<{ size: number }>();
</script>

<style scoped>
@import "tailwindcss";

.infinite-spinner {
    @apply p-1 flex justify-center;
    > div {
        height: var(--size);
        width: var(--size);
        background: url("https://i.imgur.com/NCYL2PJ.png") no-repeat;
        background-position: center center;
        background-size: var(--size);
        transform-origin: center;
        animation: 900ms spin infinite linear;
    }
}
@keyframes spin {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
}
</style>
