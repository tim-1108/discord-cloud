<script setup lang="ts">
import { onMounted, useTemplateRef } from "vue";

const ref = useTemplateRef("dialog");
onMounted(() => {
    ref.value?.showModal();
});
</script>

<template>
    <dialog class="bg-white px-8 place-self-center rounded-3xl grid gap-4 relative grid-rows-[min-content_1fr_min-content]" ref="dialog">
        <header class="sticky top-0 bg-white z-10 pt-8 pb-2">
            <slot name="header"></slot>
        </header>
        <main class="pb-2">
            <slot name="main"></slot>
        </main>
        <footer class="sticky bottom-0 bg-white z-10">
            <slot name="footer"></slot>
        </footer>
    </dialog>
</template>

<style scoped>
@import "tailwindcss";

dialog {
    animation: key forwards cubic-bezier(0.5, 0, 0, 1) 250ms;
}
dialog::backdrop {
    @apply bg-black/80;
}

@keyframes key {
    from {
        scale: 50%;
        opacity: 0%;
    }
    to {
        scale: 100%;
        opacity: 100%;
    }
}
</style>
