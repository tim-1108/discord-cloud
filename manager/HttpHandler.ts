import express, { type Express } from "express";
import { createService, findMethodsForServiceType, onServiceClose } from "./services/list.js";
import http from "node:http";
import { WebSocket, type WebSocketServer } from "ws";
import { cleanURL, getSearchParamsFromPath } from "./utils/url.js";
import { Client } from "./Client.js";
import { getEnvironmentVariables } from "../common/environment.js";

export class HttpHandler {
    private readonly server: http.Server;
    private readonly app: Express;
    private readonly socket: WebSocketServer;

    private ready: boolean = false;

    public constructor(port: number) {
        this.app = express();
        this.server = http.createServer(this.app);
        this.socket = new WebSocket.Server({ server: this.server });

        /* === HTTP === */
        this.app.use(express.json());

        /* === SOCKET === */
        this.socket.on("connection", (ws) => this.handleSocketConnection(ws));
        this.socket.on("error", (err) => console.warn("[WS Error]", err));

        this.server.on("error", (err: Error) => {
            console.error(`[HttpHandler Server Error]`, err);
        });
        this.server.listen(port, () => (this.ready = true));
    }

    public isReady() {
        return this.ready;
    }

    private handleSocketConnection(ws: WebSocket) {
        const { CLIENT_PASSWORD, SERVICE_PASSWORD } = getEnvironmentVariables("manager");
        // Note: This should be impossible
        if (!this.isReady()) {
            ws.close();
            return;
        }
        const [type, key, address] = getSearchParamsFromPath(ws.url, "type", "key", "address");
        if (!key) {
            return void ws.close();
        }

        if (type === "client") {
            if (key !== CLIENT_PASSWORD) {
                return void ws.close();
            }
            // The thing just needs to be called and is self-initializing
            // Might be weird to handle, so this might be changed in the future.
            new Client(ws);
            return;
        }

        if (!type || !address) {
            // No justice for you!
            return void ws.close();
        }

        const url = cleanURL(address);
        if (!url || key !== SERVICE_PASSWORD) {
            return void ws.close();
        }
        // Without proper credentials, the requester should never reach this point
        const service = createService(type, { address: url, socket: ws });
        if (!service) {
            return void ws.close();
        }

        console.info("[HttpHandler] New service created of type", type);
        const methods = findMethodsForServiceType(service);
        methods.add();

        ws.onclose = () => void onServiceClose(service, methods.delete);
    }
}
