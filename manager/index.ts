import { validateEnviromentVariables } from "../common/environment.ts";
import { HttpHandler } from "./HttpHandler.ts";

validateEnviromentVariables("common", "manager");

const requestHandler = new HttpHandler(4000);
