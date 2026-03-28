<script setup lang="ts">
import type { ConfirmDialogConfig } from "@/composables/dialog";

defineProps<{ cfg: ConfirmDialogConfig; callback: (val: boolean) => void }>();
</script>

<template>
    <BaseDialog>
        <template v-slot:header>
            <h1>{{ cfg.title ?? "Confirm" }}</h1>
        </template>
        <template v-slot:main>
            <p>{{ cfg.body }}</p>
        </template>
        <template v-slot:footer>
            <div class="flex justify-end gap-2 py-4">
                <ThemedButton color="red" @click="callback(false)">{{ cfg.cancel ?? "Abort" }}</ThemedButton>
                <ThemedButton color="green" @click="callback(true)">{{ cfg.confirm ?? "Confirm" }}</ThemedButton>
            </div>
        </template>
    </BaseDialog>
</template>
