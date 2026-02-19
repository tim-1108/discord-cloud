import "./assets/main.css";

import { createApp } from "vue";
import App from "./App.vue";
import { getOrCreateCommunicator } from "./composables/authentication.js";
import { vIntersectionObserver } from "@vueuse/components";
import { createRouter, createWebHistory } from "vue-router";
import BrowseView from "./pages/BrowseView.vue";
import { navigateToAbsolutePath } from "./composables/path.js";
import { patterns } from "../../common/patterns.js";

// TODO: Why is this router not available when calling useRouter()??
const history = createWebHistory();
export const router = createRouter({
    history,
    routes: [{ path: "/:segment*", component: BrowseView }]
});

history.listen((to) => {
    // Created to filter out parameters and the hash.
    const obj = URL.parse(`http://localhost${to}`);
    if (!obj) return;
    const pathname = decodeURIComponent(obj.pathname);
    if (!patterns.stringifiedPath.test(pathname)) return;
    navigateToAbsolutePath(pathname);
});

const app = createApp(App);
app.use(router);
app.directive("intersection-observer", vIntersectionObserver);
app.mount("#app");

void getOrCreateCommunicator();
