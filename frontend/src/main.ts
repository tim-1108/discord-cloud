import "./assets/main.css";

import { createApp } from "vue";
import App from "./App.vue";
import { Communicator } from "./socket/Communicator.js";

setTimeout(() => createApp(App).mount("#app"), 0);
// TODO: in dev scenarios (vite dev) this gets run twice
export const communicator = new Communicator();
