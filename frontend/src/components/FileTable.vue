<script setup lang="ts">
import { useCurrentFolderListing } from "@/composables/listing";
import { parseFileSize } from "../../../common/useless";

const listing = useCurrentFolderListing();
</script>

<template>
    <table v-if="typeof listing !== 'string'">
        <thead>
            <tr>
                <th>Select</th>
                <th>Name</th>
                <th>Size</th>
                <th>Created at</th>
                <th>Updated at</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>
            <tr v-for="file of listing.files">
                <td></td>
                <td>{{ file.name }}</td>
                <td>{{ parseFileSize(file.size) }}</td>
                <td>{{ file.created_at }}</td>
                <td>{{ file.updated_at }}</td>
            </tr>
        </tbody>
    </table>
    <div v-else>{{ listing }}</div>
</template>
