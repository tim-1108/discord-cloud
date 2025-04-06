import "./assets/main.css";

import { createApp } from "vue";
import App from "./App.vue";
import { Communicator } from "./socket/Communicator.js";
import { getAuthentication } from "./composables/authentication.js";

createApp(App).mount("#app");
export let communicator: Communicator;
async function initializeCommunicator() {
    const authentication = await getAuthentication();

    const socketUrl = new URL(authentication.address);
    socketUrl.searchParams.append("type", "client");
    socketUrl.searchParams.append("key", authentication.password);

    // TODO: get this outta here
    communicator = new Communicator(socketUrl.toString());
}

initializeCommunicator();
