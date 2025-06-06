<script setup lang="ts">
import type { ConfirmDialogConfig } from "@/composables/dialog";
import BaseDialog from "./BaseDialog.vue";
import StyledButton from "../basic/StyledButton.vue";

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
                <StyledButton color="critical" @click="callback(false)">{{ cfg.cancel ?? "Abort" }}</StyledButton>
                <StyledButton color="submit" @click="callback(true)">{{ cfg.confirm ?? "Confirm" }}</StyledButton>
            </div>
        </template>
    </BaseDialog>
</template>
