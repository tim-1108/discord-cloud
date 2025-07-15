<script setup lang="ts">
const buttonColorClass = {
    default: "!bg-black",
    info: "!bg-blue-500",
    warning: "!bg-amber-500",
    submit: "!bg-lime-500",
    critical: "!bg-red-500"
};
const disabledButtonColors: Record<ButtonColor, string> = {
    default: "!bg-gray-900",
    info: "!bg-blue-300",
    warning: "!bg-amber-300",
    submit: "!bg-lime-100",
    critical: "!bg-red-300"
};
type ButtonColor = keyof typeof buttonColorClass;

defineProps<{ color: ButtonColor; disabled?: boolean }>();
</script>

<template>
    <button
        class="py-2 px-4 font-bold rounded-lg text-center hover:shadow-lg transition-shadow"
        :class="{
            'cursor-pointer': !disabled,
            'cursor-not-allowed': disabled,
            [disabledButtonColors[color]]: disabled,
            [buttonColorClass[color]]: !disabled
        }"
        :disabled="disabled">
        <slot />
    </button>
</template>
