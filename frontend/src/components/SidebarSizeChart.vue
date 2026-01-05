<script setup lang="ts">
import { UncachedListing, type GetSizeReturn } from "@/composables/listing_uncached";
import { convertRouteToPath, useCurrentRoute } from "@/composables/path";
import { computed, onMounted, ref, watch } from "vue";
import { formatByteString } from "../../../common/useless";
import { mergeFileTypesAndSort } from "@/composables/file-types";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";

const props = defineProps<{ folderId: number | null }>();
const data = ref<GetSizeReturn | null>(null);
const error = ref<string | null>(null);
watch(props, (val) => {
    // It does not work to compare to old value, as they are the same (for some reason)
    // However, this is the only prop.
    void fetchStats(val.folderId);
});

async function fetchStats(fid: number | null) {
    const res = await UncachedListing.getSizes(fid);
    // should not use if/else statement because if an error occurs, the previous
    // data field would not be overwritten, and the other other way around too
    data.value = res.data;
    error.value = res.error;
}
onMounted(() => fetchStats(props.folderId));

const sortedTypes = computed(() => {
    if (data.value === null) return [];
    return mergeFileTypesAndSort(data.value.types);
});
</script>

<template>
    <div class="grid gap-2">
        <h2>Properties</h2>
        <template v-if="data !== null">
            <h3>{{ formatByteString(data.total_size, { type: "only-bytes-full", has_spacing: true }) }}</h3>
            <div class="" v-for="{ size, name, icon, color } of sortedTypes">
                <div class="flex items-center gap-2">
                    <FontAwesomeIcon :icon="icon" :style="{ color: color ?? 'black' }"></FontAwesomeIcon>
                    <p>{{ name }}</p>
                </div>
                <ProgressBar :progress="size / data.total_size" :color="color"></ProgressBar>
                <p>{{ formatByteString(size, { type: "only-bytes-full", has_spacing: true }) }}</p>
            </div>
        </template>
    </div>
</template>
