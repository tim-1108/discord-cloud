<script setup lang="ts">
import { ref } from "vue";
import BaseDialog from "./BaseDialog.vue";
import { globals } from "@/composables/globals";
import StyledButton from "../basic/StyledButton.vue";

const address = ref("");
const username = ref("");
const password = ref("");

function resolve() {
    globals.authentication.resolvePromise({ address: address.value, username: username.value, password: password.value });
}
</script>

<template>
    <BaseDialog>
        <template v-slot:header>
            <h1>Login</h1>
        </template>
        <template v-slot:main>
            <form class="grid gap-2" @submit.prevent="resolve">
                <h3>Address</h3>
                <input type="text" required v-model="address" />
                <h3>Username</h3>
                <input type="text" required v-model="username" />
                <h3>Password</h3>
                <input type="password" required v-model="password" />
                <StyledButton type="submit" color="submit">Submit and Login</StyledButton>
            </form>
        </template>
    </BaseDialog>
</template>
