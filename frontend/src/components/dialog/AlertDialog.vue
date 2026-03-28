<script setup lang="ts">
import type { AlertDialogConfig } from "@/composables/dialog";

defineProps<{ cfg: AlertDialogConfig; callback: () => void }>();
</script>

<template>
    <BaseDialog>
        <template v-slot:header>
            <h1>{{ cfg.title ?? "Alert" }}</h1>
        </template>
        <template v-slot:main>
            <p>{{ cfg.body }}</p>
        </template>
        <template v-slot:footer>
            <div class="flex justify-end gap-2 py-4">
                <ThemedButton color="green" @click="callback">{{ cfg.confirm ?? "OK" }}</ThemedButton>
            </div>
        </template>
    </BaseDialog>
</template>
