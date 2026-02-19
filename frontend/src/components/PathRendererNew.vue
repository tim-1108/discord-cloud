<script setup lang="ts">
import { useListingRoute, navigateToAbsolutePath, navigateUpPath, navigateToRoot } from "@/composables/path";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from "vue";
import ThemedButton from "./theme/ThemedButton.vue";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { faPen, faCaretLeft, faCaretRight } from "@fortawesome/free-solid-svg-icons";

const Constants = {
    mobileMaxWidth: 767
} as const;

const route = useListingRoute();
const isEditing = ref(false);
/**
 * The index of the visible section of the route
 * when the mode is `single`.
 */
const index = ref(0);
const mode = ref<"full" | "single">("full");
const hasNext = computed(() => index.value < route.value.length - 1);
const hasPrevious = computed(() => index.value > -1);

// The list is used to measure whether it would go above the
// allowed size of the container. If so, we switch to the mode
// where we only show one at a time.
const listEl = useTemplateRef("list");
const wrapperEl = useTemplateRef("wrapper");

watch(route, checkSwitch, { deep: true });
onMounted(() => {
    window.addEventListener("resize", checkSwitch);
    checkSwitch();
});
onBeforeUnmount(() => {
    window.removeEventListener("resize", checkSwitch);
});

async function checkSwitch(): Promise<void> {
    if (!wrapperEl.value || !listEl.value) return;

    // This allows the UI to rerender before we actually
    // take the width of the component. If the route updated,
    // this here would likely get called before the rerender
    // has happend.
    await nextTick();

    const widthFlag = window.innerWidth <= Constants.mobileMaxWidth;
    const scrollFlag = listEl.value.scrollWidth >= wrapperEl.value.clientWidth;
    const modeset = scrollFlag || widthFlag ? "single" : "full";
    mode.value = modeset;
    if (modeset === "single") {
        // This means that if we are in the root folder, this is -1
        index.value = route.value.length - 1;
    }
}
</script>

<template>
    <div ref="wrapper" class="font-bold">
        <template v-if="!isEditing">
            <div class="flex min-w-0 w-fit" ref="list" :class="{ 'absolute opacity-0 pointer-events-none': mode === 'single' }">
                <ThemedButton :selected="route.length === 0" @click="navigateToRoot">~</ThemedButton>
                <ThemedButton
                    class="whitespace-nowrap"
                    v-for="(name, index) of route"
                    :selected="index === route.length - 1"
                    padding="small"
                    @click="navigateUpPath(index)"
                    >{{ name }}</ThemedButton
                >
                <ThemedButton padding="small"><FontAwesomeIcon :icon="faPen"></FontAwesomeIcon></ThemedButton>
            </div>
            <div v-if="mode === 'single'" class="w-full grid grid-cols-[auto_1fr_auto_auto] min-w-full">
                <ThemedButton :disabled="!hasPrevious" padding="small" @click="index--">
                    <FontAwesomeIcon :icon="faCaretLeft"></FontAwesomeIcon>
                </ThemedButton>
                <ThemedButton
                    :selected="index === route.length - 1"
                    padding="small"
                    class="min-w-0 whitespace-nowrap overflow-hidden text-ellipsis"
                    @click="index === -1 ? navigateToRoot() : navigateUpPath(index)"
                    >{{ index === -1 ? "~" : route[index] }}</ThemedButton
                >
                <ThemedButton :disabled="!hasNext" padding="small" @click="index++"
                    ><FontAwesomeIcon :icon="faCaretRight"></FontAwesomeIcon
                ></ThemedButton>
                <ThemedButton padding="small"><FontAwesomeIcon :icon="faPen"></FontAwesomeIcon></ThemedButton>
            </div>
        </template>
    </div>
</template>
