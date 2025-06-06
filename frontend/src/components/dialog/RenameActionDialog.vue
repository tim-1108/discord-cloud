<script setup lang="ts">
import { computed, ref } from "vue";
import BaseDialog from "./BaseDialog.vue";
import StyledButton from "../basic/StyledButton.vue";
import { patterns } from "../../../../common/patterns";

const props = defineProps<{ name: string }>();
const newName = ref(props.name);
const isValid = computed(() => patterns.fileName.test(newName.value));

const emit = defineEmits<{ rename: [name: string]; abort: [] }>();
</script>

<template>
    <BaseDialog>
        <template v-slot:header>
            <h1>
                Rename <b>{{ name }}</b>
            </h1>
        </template>
        <template v-slot:main>
            <input type="text" class="w-full" placeholder="Enter a new name" v-model="newName" />
        </template>
        <template v-slot:footer>
            <div class="flex justify-end gap-2">
                <StyledButton color="critical" @click="emit('abort')">Abort</StyledButton>
                <StyledButton color="submit" @click="emit('rename', newName)" :disabled="!isValid || newName === name">Submit</StyledButton>
            </div>
        </template>
    </BaseDialog>
</template>
