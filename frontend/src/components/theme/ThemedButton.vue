<script setup lang="ts">
const colors = {
    red: ["#ff2535", "white", "#891119"],
    blue: ["#006aff", "white", "#002d6d"],
    green: ["#35aa35", "white", "#265926"],
    blueish: ["#004a77", "rgb(194, 231, 255)", "#002942"],
    default: ["#dedede", "black", "#757575"]
} as const;
type Color = keyof typeof colors;
const { disabled, selected, color, padding } = defineProps<{
    disabled?: boolean;
    selected?: boolean;
    color?: Color;
    padding?: "none" | "default" | "small";
}>();

const colorEntry = colors[color ?? "default"];
</script>

<template>
    <button
        :data-color="color ?? 'default'"
        :disabled="disabled"
        :data-selected="selected ? '' : null"
        :data-padding="padding ?? 'default'"
        :style="{ backgroundColor: disabled ? colorEntry[2] : colorEntry[0], color: colorEntry[1] }">
        <span>
            <slot />
        </span>
    </button>
</template>

<style scoped lang="css">
button {
    position: relative;
    font-size: 20px;
    padding: 0;
    cursor: pointer;

    --time: 120ms;
    --foot-height: 8px;
    --inverted-foot-height: calc(var(--foot-height) * -1);
    --y-padding: 10px;
    --x-padding: 30px;

    padding: var(--y-padding) var(--x-padding) calc(var(--y-padding) + var(--foot-height)) var(--x-padding);
    transition-property: padding margin;
    transition-duration: var(--time);
    transition-timing-function: ease-in-out;

    border: 2px solid rgba(100, 100, 100, 0.75);
}

button[data-padding="small"] {
    --x-padding: 10px;
}

button[data-padding="none"] {
    --x-padding: 0;
}

button[data-selected]::before {
    content: "";
    position: absolute;
    justify-self: center;
    height: 4px;
    width: 30px;
    left: calc(50% - 15px);
    bottom: 0;
    background: white;
    z-index: 2;
}

button::after {
    box-shadow:
        inset 0px var(--inverted-foot-height) 0px 0px rgb(104, 104, 104),
        inset 0px var(--inverted-foot-height) 0px 2px rgba(160, 160, 160, 1),
        inset 0px 2px 0px 0px rgba(160, 160, 160, 1);
    position: absolute;
    content: "";
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    mix-blend-mode: hard-light;
    transition-property: background-color box-shadow;
    transition-duration: var(--time);
    transition-timing-function: inherit;
    display: block;
}

button:not([disabled]):active::after,
button[data-selected]::after {
    box-shadow: inset 0px 0px 0px 2px rgba(230, 230, 230, 1);
    background-color: rgba(0, 0, 0, 0.08);
}

button[disabled] {
    @apply cursor-not-allowed;
}

button:not([data-selected]):not([disabled]):active,
button[data-selected] {
    padding-bottom: var(--y-padding);
    margin-top: var(--foot-height);
}

button:hover::after {
    background-color: #eeeeee10;
}
</style>
