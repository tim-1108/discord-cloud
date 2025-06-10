<script setup lang="ts">
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
defineProps<{ icon?: IconDefinition; styling: "large" | "default" }>();
</script>

<template>
    <button
        class="bg-[var(--text-selected-color)] text-[var(--selected-color)] items-center flex drop-shadow transition-all rounded-xl hover:shadow-lg hover:bg-[var(--text-selected-color-lighter)]"
        :class="{ 'gap-2 px-4 py-2': styling === 'default', 'gap-4 p-4': styling === 'large' }">
        <FontAwesomeIcon :icon="icon" v-if="icon"></FontAwesomeIcon>
        <span>
            <slot></slot>
        </span>
    </button>
</template>
