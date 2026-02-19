<script setup lang="ts">
import { computed, ref } from "vue";

const { pageCount } = defineProps<{ pageCount: number }>();
const page = ref(0);
// actually rendered page value
const p = computed(() => page.value + 1);
// remainder of pages
const r = computed(() => pageCount - page.value);
const emit = defineEmits<{ navigate: [page: number] }>();

function navigate($page: number) {
    page.value = $page;
    emit("navigate", $page);
}
</script>

<template>
    <div class="flex w-full justify-center gap-2 text-center font-bold text-lg select-none" v-if="pageCount">
        <div class="page" v-if="p > 2" @click="navigate(page - 2)">{{ p - 2 }}</div>
        <div class="page" v-if="p > 1" @click="navigate(page - 1)">{{ p - 1 }}</div>
        <div class="cursor-not-allowed rounded-xl bg-[var(--text-selected-color)] p-1 min-w-8 text-[var(--selected-color)]">{{ p }}</div>
        <div class="page" v-if="r > 1" @click="navigate(page + 1)">{{ p + 1 }}</div>
        <div class="page" v-if="r > 2" @click="navigate(page + 2)">{{ p + 2 }}</div>
    </div>
</template>

<style scoped>
@import "tailwindcss";
.page {
    @apply rounded-xl bg-[var(--component-color)] p-1 min-w-8 cursor-pointer hover:active:scale-90 transition-transform;
}
</style>
