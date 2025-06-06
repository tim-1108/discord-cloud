import "./assets/main.css";

import { createApp } from "vue";
import App from "./App.vue";
import { Communicator } from "./socket/Communicator.js";
import { clearAuthentication, getAuthentication } from "./composables/authentication.js";

createApp(App).mount("#app");
export let communicator: Communicator;
(async () => {
    // TODO: Rework!!!!
    const authentication = await getAuthentication();

    const socketUrl = new URL(authentication.address);
    const httpUrl = new URL(authentication.address);
    httpUrl.protocol = "http:";
    httpUrl.pathname = "/login";
    httpUrl.searchParams.append("username", authentication.username);
    httpUrl.searchParams.append("password", authentication.password);

    const response = await fetch(httpUrl);
    const data = await response.json();

    if (!data.token) {
        alert("Invalid authentication");
        clearAuthentication();
        location.reload();
        return;
    }

    socketUrl.searchParams.append("type", "client");
    socketUrl.searchParams.append("key", data.token);

    communicator = new Communicator(socketUrl.toString());
})();
