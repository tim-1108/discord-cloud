<script setup lang="ts">
import { getMaxDesiredUploaders, Uploads } from "@/composables/uploads";
const maxDesiredUploaders = getMaxDesiredUploaders();
</script>

<template>
    <BaseFlyout>
        <p>All running uploads as well as some settings will be listed here.</p>
        <h3>Desired and presently booked upload services</h3>
        <div class="grid grid-cols-2">
            <IntegerChooser :min="0" :max="maxDesiredUploaders" :reference="Uploads.booking.desired" class="w-full"></IntegerChooser>
            <ThemedButton selected>{{ Uploads.booking.available }}</ThemedButton>
        </div>
    </BaseFlyout>
</template>
