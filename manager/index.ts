import dotenv from "dotenv";
import { HttpHandler } from "./HttpHandler.ts";
dotenv.config({ path: `${__dirname}/.env` });

const requestHandler = new HttpHandler(4000);
