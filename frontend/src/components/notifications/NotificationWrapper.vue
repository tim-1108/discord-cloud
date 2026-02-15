<template>
    <div class="fixed grid bottom-24 md:bottom-6 right-6 z-[500] gap-2">
        <NotificationItem v-for="[key, notification] of notifications" :id="key" :key="key" :item="notification"></NotificationItem>
    </div>
</template>

<script setup lang="ts">
import { useNotifications } from "@/composables/notifications";

const notifications = useNotifications();
</script>
