<script setup lang="ts">
import { Uploads } from "@/composables/uploads";
</script>

<template>
    <BaseFlyout>
        <p>All running uploads as well as some settings will be listed here.</p>
        <p>Booked: {{ Uploads.booking.available }} | Desired: {{ Uploads.booking.desired }}</p>
    </BaseFlyout>
</template>
