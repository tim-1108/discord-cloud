<script setup lang="ts">
import { onMounted, useTemplateRef } from "vue";

const ref = useTemplateRef("dialog");
onMounted(() => {
    ref.value?.showModal();
});
</script>

<template>
    <dialog
        class="bg-white px-6 place-self-center rounded-3xl grid gap-2 relative grid-rows-[min-content_1fr_min-content] min-w-0"
        ref="dialog"
        @cancel.prevent="(e) => e.preventDefault()">
        <header class="sticky top-0 bg-white z-10 pt-4 pb-2">
            <slot name="header"></slot>
        </header>
        <main class="pb-2 min-w-0 w-full overflow-auto">
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
    --bg-color: #e9eef6;
    animation: key forwards cubic-bezier(0.5, 0, 0, 1) 250ms;
}
dialog,
dialog > header,
dialog > footer {
    background-color: var(--bg-color);
}
dialog::backdrop {
    @apply bg-black/80;
}

@keyframes key {
    from {
        scale: 80%;
        opacity: 0%;
    }
    to {
        scale: 100%;
        opacity: 100%;
    }
}
</style>
