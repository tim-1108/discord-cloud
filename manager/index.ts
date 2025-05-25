import { validateEnvironmentVariables } from "../common/environment.js";
import { Authentication } from "./authentication.js";
import { Network } from "./Network.js";

validateEnvironmentVariables("common", "manager", "discord", "crypto");

const requestHandler = new Network(4000);
