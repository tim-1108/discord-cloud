<script setup lang="ts">
import { globals } from "@/composables/globals";
import { ref } from "vue";

const address = ref("");
const password = ref("");
</script>

<template>
    <div class="grid">
        <h1>Auth</h1>
        <form @submit.prevent="globals.authentication.resolvePromise({ password, address })">
            <input v-model="address" required placeholder="Adresse" />
            <input v-model="password" required placeholder="Passwort" />
            <button type="submit">Absenden!</button>
        </form>
    </div>
</template>
