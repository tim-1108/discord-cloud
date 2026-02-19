<script setup lang="ts">
import { Flyout, type FlyoutRegistryKey } from "@/composables/flyout";
import { computed, useTemplateRef } from "vue";
import { logWarn } from "../../../common/logging";

const { flyoutKey } = defineProps<{ flyoutKey: FlyoutRegistryKey }>();

const isSelected = computed(() => Flyout.status(flyoutKey));

function click() {
    if (isSelected.value) return;
    Flyout.mount(flyoutKey, `.status-bar-item#${flyoutKey}`);
}
</script>

<template>
    <ThemedButton :selected="isSelected" padding="small" @click="click" class="status-bar-item" :id="flyoutKey">
        <slot />
    </ThemedButton>
</template>
