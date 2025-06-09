import "./assets/main.css";

import { createApp } from "vue";
import App from "./App.vue";
import { Communicator } from "./socket/Communicator.js";
import { clearAuthentication, getAuthentication } from "./composables/authentication.js";
import { vIntersectionObserver } from "@vueuse/components";
import { Dialogs } from "./composables/dialog.js";

const app = createApp(App);
app.directive("intersection-observer", vIntersectionObserver);
app.mount("#app");

export let communicator: Communicator;
(async () => {
    // TODO: Rework!!!!
    const authentication = await getAuthentication();

    const socketUrl = new URL(authentication.address);
    socketUrl.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const httpUrl = new URL(authentication.address);
    // No "mixed content" is allowed
    httpUrl.protocol = window.location.protocol;
    httpUrl.pathname = "/login";
    httpUrl.searchParams.append("username", authentication.username);
    httpUrl.searchParams.append("password", authentication.password);

    const response = await fetch(httpUrl);
    const data = await response.json();

    if (!data.token) {
        await Dialogs.alert({ title: "Authentication failed", body: "Your authentication may be incorrect. You will be logged off" });
        clearAuthentication();
        location.reload();
        return;
    }

    socketUrl.searchParams.append("type", "client");
    socketUrl.searchParams.append("key", data.token);

    communicator = new Communicator(socketUrl.toString());
})();
