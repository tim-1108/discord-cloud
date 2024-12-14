import { validateEnvironmentVariables } from "../common/environment.js";
import { HttpHandler } from "./HttpHandler.js";

validateEnvironmentVariables("common", "manager");

const requestHandler = new HttpHandler(4000);
