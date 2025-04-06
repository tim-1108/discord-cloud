<script setup lang="ts">
import { useSidebarState } from "@/composables/sidebar";
import BasicSection from "./basic/BasicSection.vue";
import SidebarAuth from "./sidebar/auth.vue";
import SidebarDefault from "./sidebar/default.vue";
import SidebarUpload from "./sidebar/upload.vue";
const state = useSidebarState();
</script>

<template>
    <BasicSection id="sidebar">
        <SidebarAuth v-if="state === 'auth'"></SidebarAuth>
        <SidebarDefault v-else-if="state === 'default'"></SidebarDefault>
        <SidebarUpload v-else-if="state === 'upload'"></SidebarUpload>
    </BasicSection>
</template>
