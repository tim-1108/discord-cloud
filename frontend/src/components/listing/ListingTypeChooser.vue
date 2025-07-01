<script setup lang="ts">
import { faGrip, faTableList, type IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { ref } from "vue";

type Type = "grid" | "table";
const emit = defineEmits<{ update: [type: Type] }>();
const props = defineProps<{ defaultValue: Type }>();

const selected = ref<Type>(props.defaultValue);
const icons: Array<[Type, IconDefinition]> = [
    ["grid", faGrip],
    ["table", faTableList]
];

function switchTo(type: Type) {
    if (selected.value === type) return;
    selected.value = type;
    emit("update", type);
}
</script>

<template>
    <div class="rounded-full border-[1px] border-black flex w-fit">
        <div
            class="px-4 py-2 first:rounded-l-full last:rounded-r-full transition-colors"
            v-for="[key, icon] of icons"
            :class="{
                'bg-[var(--text-selected-color)] text-[var(--selected-color)] cursor-not-allowed': selected === key,
                'hover:shadow hover:bg-[var(--text-selected-color-lighter)] hover:text-white cursor-pointer': selected !== key
            }"
            @click="switchTo(key)">
            <FontAwesomeIcon :icon="icon"></FontAwesomeIcon>
        </div>
    </div>
</template>
