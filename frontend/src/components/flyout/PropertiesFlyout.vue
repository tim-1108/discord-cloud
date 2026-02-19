<script setup lang="ts">
import { useListingMetadata } from "@/composables/listing_uncached";
import { Flyout } from "@/composables/flyout";

const metadata = useListingMetadata();
</script>

<template>
    <BaseFlyout class="w-52">
        <SidebarSizeChart v-if="metadata" @loaded="Flyout.updatePosition"></SidebarSizeChart>
        <InfiniteSpinner :size="20" v-else></InfiniteSpinner>
    </BaseFlyout>
</template>
