<script setup lang="ts">
import { Flyout, useFlyoutPosition } from "@/composables/flyout";
import { computed, nextTick, onMounted, useTemplateRef } from "vue";

const position = useFlyoutPosition();
function getPos(index: number) {
    return computed(() => (position.value ? `${position.value[index]}px` : "0"));
}
const left = getPos(0);
const top = getPos(1);
const width = getPos(2);
const height = getPos(3);
const el = useTemplateRef("flyout");

onMounted(() => {
    Flyout.resolve(el.value);
});
</script>

<template>
    <div
        class="flyout bg-(--component-color) rounded-lg shadow-lg fixed z-3 border border-(--border-color) px-4 py-2"
        :class="{ 'opacity-0 pointer-events-none': position === null }"
        :style="{ left, top }"
        ref="flyout">
        <slot />
    </div>
</template>
