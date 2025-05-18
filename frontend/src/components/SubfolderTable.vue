<script setup lang="ts">
import type { Listing } from "@/composables/listing";
import { appendToRoute } from "@/composables/path";

const props = defineProps<{ listing: Listing }>();
</script>

<template>
    <table v-if="typeof listing !== 'string'">
        <thead>
            <tr>
                <th>Name</th>
            </tr>
        </thead>
        <tbody>
            <tr v-for="folder of listing.folders" @click="appendToRoute([folder.name])">
                <td>{{ folder.name }}</td>
            </tr>
        </tbody>
    </table>
</template>
