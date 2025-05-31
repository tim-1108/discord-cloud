<script setup lang="ts">
import type { IconDefinition } from "@fortawesome/free-solid-svg-icons";

type Column<T = string> = {
    name: string;
    key: string;
    transformer: (value?: T) => string;
    sort: (a: T, b: T, dir: SortingDirection) => number;
};

interface Action {
    id: string;
    icon: IconDefinition;
    name: string;
}

type SortingDirection = "asc" | "desc";

const props = defineProps<{ columns: Column[]; actions: Action[]; allowSelect?: boolean }>();
const emit = defineEmits<{ selected: []; click: []; context: []; action: [action: string] }>();
</script>

<template>
    <table>
        <thead>
            <tr>
                <th v-if="allowSelect">Select</th>
            </tr>
        </thead>
    </table>
</template>
