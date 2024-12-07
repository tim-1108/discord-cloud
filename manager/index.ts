import { validateEnvironmentVariables } from "../common/environment";
import { HttpHandler } from "./HttpHandler";

validateEnvironmentVariables("common", "manager");

const requestHandler = new HttpHandler(4000);
