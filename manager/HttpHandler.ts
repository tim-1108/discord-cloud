import express, { type Express } from "express";
import { createService, findMethodsForServiceType } from "./services/list.ts";
import http from "http";
import { WebSocket, type WebSocketServer } from "ws";
import { cleanURL, getSearchParamsFromPath } from "./utils/url.ts";
import { Client } from "./Client.ts";

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
        // Note: This should be impossible
        if (!this.isReady()) {
            ws.close();
            return;
        }
        const [type, key, address] = getSearchParamsFromPath(ws.url, "type", "key", "address");

        if (type === "client") {
            // The thing just needs to be called and is self-initializing
            // Might be weird to handle so this might be changed in the future.
            new Client(ws);
            return;
        }

        if (!type || !key || !address) {
            // No justice for you!
            ws.close();
            return;
        }

        const url = cleanURL(address);
        if (!url || key !== process.env.SERVICE_LOGIN_KEY) {
            ws.close();
            return;
        }
        // Without proper credentials, the requester should never reach this point
        const service = createService(type, { address: url, socket: ws });
        if (!service) {
            ws.close();
            return;
        }

        console.info("[HttpHandler] New service created of type", type);
        const methods = findMethodsForServiceType(service);
        methods.add();

        ws.onclose = () => {
            console.info("[HttpHandler] Closed service of type", type);
            // Sadly, not much we can do.
            if (service.isBusy()) {
                console.warn("---> Removed service was still busy :/");
            }
            methods.delete();
        };
    }
}
