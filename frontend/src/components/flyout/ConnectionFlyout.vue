<script setup lang="ts">
import { PendingAuthenticationState } from "@/composables/state";
</script>

<template>
    <BaseFlyout>
        <span>{{ PendingAuthenticationState }}</span>
    </BaseFlyout>
</template>
