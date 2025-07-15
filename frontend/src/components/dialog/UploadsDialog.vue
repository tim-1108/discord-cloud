<script setup lang="ts">
import { Uploads } from "@/composables/uploads";
import { formatByteString } from "../../../../common/useless";
import { Dialogs } from "@/composables/dialog";

const queue = Uploads.queue.count;
const active = Uploads.active;
</script>

<template>
    <BaseDialog>
        <template v-slot:header>
            <h1>Your active uploads</h1>
        </template>
        <template v-slot:main>
            <div class="grid gap-4">
                <div v-for="[_, upload] of active" class="border-2 border-black">
                    <p>{{ upload.file.name }} at {{ upload.path }} ({{ formatByteString(upload.file.size) }})</p>
                    <p>Uploaded chunks: {{ upload.processed_chunks }}/{{ upload.chunks }}</p>
                    <p>Target: {{ upload.targetAddress }}</p>
                </div>
            </div>
            <p>In the queue: {{ queue }}</p>
        </template>
        <template v-slot:footer>
            <div class="flex justify-end gap-2">
                <StyledButton color="critical" @click="Dialogs.unmount('uploads')">Close</StyledButton>
            </div>
        </template>
    </BaseDialog>
</template>
