<script setup lang="ts">
import { Uploads } from "@/composables/uploads";
import { formatByteString } from "../../../../common/useless";

const queue = Uploads.queue.count;
const active = Uploads.active;
</script>

<template>
    <BaseDialog>
        <template v-slot:header>
            <h1>Your active uploads</h1>
        </template>
        <template v-slot:main>
            <div class="grid gap-2">
                <div v-for="[_, upload] of active">
                    <p>{{ upload.file.name }} at {{ upload.path }} ({{ formatByteString(upload.file.size) }})</p>
                    <p>Uploaded chunks: {{ upload.processed_chunks }}/{{ upload.chunks }}</p>
                    <p>Target: {{ upload.targetAddress }}</p>
                </div>
            </div>
            <p>In the queue: {{ queue }}</p>
        </template>
    </BaseDialog>
</template>
