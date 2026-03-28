<script setup lang="ts">
import type { ResolveFunction } from "../../../../common";

defineProps<{ path: string; resolve: ResolveFunction<"skip" | "keep" | "skip-all"> }>();
</script>

<template>
    <BaseDialog>
        <template v-slot:header>
            <h1>Skip folder</h1>
        </template>
        <template v-slot:main>
            <p>Do you want to keep uploading a file at the blacklisted folder named "{{ path }}"?</p>
        </template>
        <template v-slot:footer>
            <div class="flex justify-end gap-2 py-4">
                <ThemedButton color="red" @click="resolve('keep')">Keep</ThemedButton>
                <ThemedButton color="green" @click="resolve('skip')">Skip</ThemedButton>
                <ThemedButton color="green" @click="resolve('skip-all')">Skip All</ThemedButton>
            </div>
        </template>
    </BaseDialog>
</template>
