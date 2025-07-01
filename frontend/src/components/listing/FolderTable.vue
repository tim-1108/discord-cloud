<script setup lang="ts">
import { appendToRoute } from "@/composables/path";
import type { FolderHandle } from "../../../../common/supabase";

defineProps<{ folderList: FolderHandle[] }>();
</script>

<template>
    <table>
        <thead>
            <tr>
                <th>Name</th>
            </tr>
        </thead>
        <tbody>
            <tr v-for="folder of folderList" @click="appendToRoute([folder.name])">
                <td>{{ folder.name }}</td>
            </tr>
        </tbody>
    </table>
</template>
