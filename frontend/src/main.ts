import "./assets/main.css";

import { createApp } from "vue";
import App from "./App.vue";
import { getOrCreateCommunicator } from "./composables/authentication.js";
import { vIntersectionObserver } from "@vueuse/components";
import { createRouter, createWebHistory } from "vue-router";
import BrowseView from "./pages/BrowseView.vue";

export const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: "/:segment*", component: BrowseView }]
});

const app = createApp(App);
app.use(router);
app.directive("intersection-observer", vIntersectionObserver);
app.mount("#app");

void getOrCreateCommunicator();
