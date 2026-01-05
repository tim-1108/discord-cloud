<script setup lang="ts">
defineProps<{ color?: string; progress: number }>();
</script>

<template>
    <div class="h-2 rounded-full bg-white shadow-sm w-full relative">
        <div class="h-full rounded-full absolute top-0 left-0" :style="{ backgroundColor: color ?? 'black', width: `${progress * 100}%` }"></div>
    </div>
</template>
