<script setup lang="ts">
import type { AlertDialogConfig } from "@/composables/dialog";
import BaseDialog from "./BaseDialog.vue";
import StyledButton from "../basic/StyledButton.vue";

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
                <StyledButton color="submit" @click="callback">{{ cfg.confirm ?? "OK" }}</StyledButton>
            </div>
        </template>
    </BaseDialog>
</template>
