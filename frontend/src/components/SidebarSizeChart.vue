<script setup lang="ts">
import { UncachedListing, useListingMetadata, type GetSizeReturn } from "@/composables/listing_uncached";
import { computed, onMounted, ref, watch } from "vue";
import { formatByteString } from "../../../common/useless";
import { mergeFileTypesAndSort } from "@/composables/file-types";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";

const metadata = useListingMetadata();
const data = ref<GetSizeReturn | null>(null);
const error = ref<string | null>(null);
watch(metadata, (value, oldValue) => {
    if (value === null) return;

    if (value.folder_id === oldValue?.folder_id) return;

    // It does not work to compare to old value, as they are the same (for some reason)
    // However, this is the only prop.
    void fetchStats(value.folder_id);
});

async function fetchStats(fid: number | null) {
    const res = await UncachedListing.getSizes(fid);
    // should not use if/else statement because if an error occurs, the previous
    // data field would not be overwritten, and the other other way around too
    data.value = res.data;
    error.value = res.error;
    emit("loaded");
}
onMounted(() => {
    if (!metadata.value) return;
    fetchStats(metadata.value.folder_id);
});

const sortedTypes = computed(() => {
    if (data.value === null) return [];
    return mergeFileTypesAndSort(data.value.types);
});

const emit = defineEmits<{ loaded: [] }>();
</script>

<template>
    <div class="grid gap-2">
        <h2>Properties</h2>
        <template v-if="data !== null && metadata !== null">
            <p>{{ metadata.file_count }} files, {{ metadata.subfolder_count }} subfolders</p>
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
        <span v-else>Error: {{ error ?? "unknown" }}</span>
    </div>
</template>
