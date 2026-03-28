<script setup lang="ts">
import { faChevronDown, faChevronUp } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import type { Ref } from "vue";

const { min, max, increment, reference } = defineProps<{ min: number; max: number; increment?: number; reference: Ref<number> }>();

function update(direction: "up" | "down"): void {
    const addition = (direction === "down" ? -1 : 1) * (increment ?? 1);
    const targetValue = reference.value + addition;
    if (targetValue > max || targetValue < min) return;
    reference.value = targetValue;
}
</script>

<template>
    <div class="grid grid-cols-[1fr_auto] grid-rows-2">
        <ThemedButton class="row-start-1 row-end-3 pointer-events-none p-0! pb-2!" disable-click>
            <input
                type="number"
                :min="min"
                :max="max"
                autofocus
                class="w-full h-full pointer-events-auto text-center bg-none! rounded-none!"
                :value="reference.value" />
        </ThemedButton>
        <ThemedButton disable-default-size padding="small" @click="update('up')">
            <FontAwesomeIcon :icon="faChevronUp"></FontAwesomeIcon>
        </ThemedButton>
        <ThemedButton disable-default-size padding="small" @click="update('down')">
            <FontAwesomeIcon :icon="faChevronDown"></FontAwesomeIcon>
        </ThemedButton>
    </div>
</template>

<style scoped>
div {
    font-size: 10px !important;
}
</style>
