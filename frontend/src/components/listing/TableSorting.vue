<script setup lang="ts">
import type { SortingField } from "@/composables/listing_uncached";
import { ListingSortAscendingState, ListingSortFieldState } from "@/composables/state";
import { faChevronDown, faChevronUp } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { computed, ref } from "vue";

const props = defineProps<{ displayName: string; id: SortingField; locked: boolean }>();
const emit = defineEmits<{ toggle: [] }>();
const ascending = ListingSortAscendingState;
const selected = computed(() => ListingSortFieldState.value === props.id);

function toggle() {
    // If this sorting option is not yet selected, we
    // do not toggle the ascending mode
    if (selected.value) ascending.value = !ascending.value;
    else {
        // Reset the ascending value whenever the selected field changes
        ascending.value = false;
        ListingSortFieldState.value = props.id;
    }
    emit("toggle");
}
</script>

<template>
    <div
        class="table-sorting flex gap-2 hover:bg-[#f5f5f5] py-2 rounded-lg items-center"
        :class="{ 'text-gray-500 hover:text-black': !selected, 'cursor-pointer': !locked, 'cursor-not-allowed': locked }"
        @click="toggle">
        <p>{{ displayName }}</p>
        <FontAwesomeIcon :icon="ascending ? faChevronUp : faChevronDown" class="text-xs" :class="{ 'opacity-0': !selected }"></FontAwesomeIcon>
    </div>
</template>
