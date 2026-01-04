<script setup lang="ts">
import { appendToRoute } from "@/composables/path";
import type { FolderHandle } from "../../../../common/supabase";

defineProps<{ folderList: FolderHandle[] }>();
</script>

<template>
    <table class="w-full">
        <thead>
            <tr>
                <th>Name</th>
            </tr>
        </thead>
        <tbody>
            <tr v-for="folder of folderList" class="hover:bg-gray-200 cursor-pointer" @click="appendToRoute([folder.name])">
                <td>{{ folder.name }}</td>
            </tr>
        </tbody>
    </table>
</template>
