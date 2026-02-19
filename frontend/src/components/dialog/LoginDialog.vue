<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useTemplateRef } from "vue";
import BaseDialog from "./BaseDialog.vue";
import { globals } from "@/composables/globals";
import StyledButton from "../basic/StyledButton.vue";
import { Authentication, getAndFixAddress, getOrCreateCommunicator, isServerAvailable } from "@/composables/authentication";
import { sleep } from "../../../../common/useless";

// All thiss code is pretty dirty and will be reworked.

const address = ref("");
const username = ref("");
const password = ref("");
const token = ref("");

const validatingCredentials = ref(false);

const targetAddress = computed(() => getAndFixAddress(address.value));

function resolve(token: string, address: URL) {
    globals.authentication.resolvePromise({ address: address.toString(), username: username.value, password: password.value, token });
}

const Constants = {
    maxOneStageAttempts: 10,
    transitionTimeMs: 300
} as const;

const stage = ref(0);
const titles = ["Welcome", "Checking availablity", "Please enter your credentials", "Logging in", "Thank you", "Uh-oh", "Uh-oh"];
const dialog = useTemplateRef("dialog");

const stageOneAttempts = ref(0);
async function stageOne() {
    if (!targetAddress.value) {
        throw new ReferenceError("Target address is invalid");
    }
    await transitionStage(1);
    stageOneAttempts.value = 0;
    while (stageOneAttempts.value < Constants.maxOneStageAttempts) {
        const flag = await isServerAvailable(targetAddress.value);
        if (flag) return transitionStage(2);
        await sleep(5000);
        stageOneAttempts.value++;
    }
    transitionStage(5);
}

async function stageThree() {
    // Due to form validation, this should be impossible.
    if (username.value.length === 0 || password.value.length === 0 || !targetAddress.value || validatingCredentials.value) return;

    validatingCredentials.value = true;
    const response = await Authentication.login({ password: password.value, username: username.value, address: targetAddress.value?.toString() });
    validatingCredentials.value = false;
    if (!response.data) {
        transitionStage(6);
        return;
    }

    transitionStage(4);
}

function stageFour() {
    if (!targetAddress.value) return;
    resolve(token.value, targetAddress.value);
}

async function transitionStage(target: number): Promise<void> {
    const str = (input: number) => `${input}px`;
    if (!dialog.value) {
        throw new ReferenceError("The dialog ref for the login dialog is not defined");
    }
    const el = dialog.value.$el as HTMLDialogElement;
    el.style.overflowY = "hidden";
    const height = el.getBoundingClientRect().height;

    stage.value = target;
    await nextTick();

    const newHeight = el.getBoundingClientRect().height;
    console.log(height, newHeight);
    el.style.height = str(height);

    const handle = el.animate([{ height: str(height) }, { height: str(newHeight) }], {
        duration: Constants.transitionTimeMs,
        easing: "ease-in-out",
        fill: "forwards"
    });

    await sleep(Constants.transitionTimeMs);
    el.style.height = "";
    el.style.overflowY = "";
    handle.cancel();
}
</script>

<template>
    <BaseDialog class="w-96" ref="dialog">
        <template v-slot:header>
            <h1>{{ titles[stage] }}</h1>
        </template>
        <template v-slot:main>
            <form @submit.prevent="stageOne" v-if="stage === 0">
                <p>
                    This is the web application for your cloud. To continue, please enter the server address to where your service is running.<br /><br />Don't
                    have a service running yet? See
                    <a target="_blank" href="https://github.com/tim-1108/discord-cloud.git">the GitHub repository</a> for setting it up.
                </p>
                <input v-model="address" spellcheck="false" required placeholder="example.com" />
                <input required v-model="targetAddress" hidden />
                <small v-if="targetAddress" class="text-gray-700"
                    >You will be connecting to <i>{{ targetAddress.toString() }}</i></small
                >
                <small v-else class="text-red-400">{{ address.length ? "Please enter a valid address" : " " }}</small>
                <ThemedButton color="blue" type="submit" :disabled="targetAddress === null">Continue</ThemedButton>
            </form>
            <div v-else-if="stage === 1">
                <p>
                    Please wait whilst we check that your service is reachable (Attempt {{ stageOneAttempts + 1 }}/{{
                        Constants.maxOneStageAttempts
                    }})
                </p>
            </div>
            <form @submit.prevent="stageThree" v-else-if="stage === 2" class="grid gap-2">
                <div>
                    <small>Username</small>
                    <input v-model="username" spellcheck="false" required />
                    <small>Password</small>
                    <input v-model="password" spellcheck="false" type="password" required />
                </div>
                <ThemedButton type="submit" color="blue" :disabled="!(username.length && password.length) || validatingCredentials"
                    >Continue</ThemedButton
                >
                <ThemedButton color="red" @click="transitionStage(0)" :disabled="validatingCredentials">Go Back</ThemedButton>
                <p>Should you have lost your credentials, please contact your administrator.</p>
            </form>
            <div v-else-if="stage === 4">
                <p>You have successfully logged in. Welcome!</p>
                <ThemedButton color="green" @click="stageFour">Enter</ThemedButton>
            </div>
            <div v-else-if="stage === 5">
                <p>Your service could not be reached. Please make sure the address is correct, the service is running and publicly accessible.</p>
                <ThemedButton color="red" @click="transitionStage(0)">Go Back</ThemedButton>
            </div>
            <div v-else-if="stage === 6">
                <p>Your credentials appear to be invalid. Please check them again.</p>
                <ThemedButton color="red" @click="transitionStage(2)">Go Back</ThemedButton>
            </div>
        </template>
    </BaseDialog>
</template>

<style scoped>
@import "tailwindcss";

input {
    @apply w-full h-10;
}
button {
    @apply w-full;
}
</style>
