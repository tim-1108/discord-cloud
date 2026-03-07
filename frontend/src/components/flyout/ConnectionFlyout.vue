<script setup lang="ts">
import { CommunicatorConnectionState } from "@/composables/state";
</script>

<template>
    <BaseFlyout>
        <span>{{ CommunicatorConnectionState }}</span>
    </BaseFlyout>
</template>
