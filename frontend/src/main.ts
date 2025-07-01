import "./assets/main.css";

import { createApp } from "vue";
import App from "./App.vue";
import { getOrCreateCommunicator } from "./composables/authentication.js";
import { vIntersectionObserver } from "@vueuse/components";

const app = createApp(App);
app.directive("intersection-observer", vIntersectionObserver);
app.mount("#app");

void getOrCreateCommunicator();
