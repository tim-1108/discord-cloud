<script setup lang="ts">
import type { OverwriteDialogConfig } from "@/composables/dialog";
import BaseDialog from "./BaseDialog.vue";
import StyledButton from "../basic/StyledButton.vue";
import type { OverwriteAction } from "@/composables/uploads";
import { ref } from "vue";
import { Uploads } from "@/composables/uploads";

const flag = ref(false);

defineProps<{ cfg: OverwriteDialogConfig; callback: (val: OverwriteAction, flag: boolean) => Promise<void> }>();
</script>

<template>
    <BaseDialog>
        <template v-slot:header>
            <h1>Overwrite file?</h1>
        </template>
        <template v-slot:main>
            <p>Do you want to overwrite "{{ cfg.fileName }}" at "{{ cfg.path }}"?</p>
        </template>
        <template v-slot:footer>
            <div class="py-4">
                <input type="checkbox" name="flag" v-model="flag" id="flag" />
                <label for="flag">Apply this action to all other files (currently {{ Uploads.overwrites.amount.value - 1 }})</label>
            </div>
            <div class="flex justify-end gap-2 py-4">
                <StyledButton color="critical" @click="callback('overwrite', flag)">Overwrite</StyledButton>
                <StyledButton color="submit" @click="callback('rename', flag)">Rename</StyledButton>
                <StyledButton color="submit" @click="callback('skip', flag)">Skip</StyledButton>
            </div>
        </template>
    </BaseDialog>
</template>
