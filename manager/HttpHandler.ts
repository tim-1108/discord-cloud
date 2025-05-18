import express, { type Express } from "express";
import http, { type IncomingMessage } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { cleanURL, getSearchParamsFromPath } from "./utils/url.js";
import { getEnvironmentVariables } from "../common/environment.js";
import socketClosureCodes from "../common/socket-closure-codes.js";
import signedDownloadRoute from "./routes/signed-download.js";
import generateSignedDownloadRoute from "./routes/generate-signed-download.js";
import downloadRoute from "./routes/download.js";
import bulkDownloadRoute from "./routes/bulk-download.js";
import healthRoute from "./routes/health.js";
import { ClientList } from "./client/list.js";
import { ServiceRegistry } from "./services/list.js";
import { logInfo } from "../common/logging.js";

export class HttpHandler {
    private readonly server: http.Server;
    private readonly app: Express;
    private readonly socket: WebSocketServer;

    private ready: boolean = false;
    private hasInitializedRoutes: boolean = false;

    public constructor(port: number) {
        this.app = express();
        this.server = http.createServer(this.app);
        this.socket = new WebSocketServer({ server: this.server });

        /* === HTTP === */
        this.app.use(express.json());
        this.setupRoutes();

        /* === SOCKET === */
        this.socket.on("connection", (ws, request) => void this.handleSocketConnection(ws, request));
        this.socket.on("error", (err) => console.warn("[WS Error]", err));

        this.server.on("error", (err: Error) => {
            console.error(`[HttpHandler Server Error]`, err);
        });
        this.server.listen(port, () => (this.ready = true));
    }

    public isReady() {
        return this.ready;
    }

    private setupRoutes() {
        if (this.hasInitializedRoutes) {
            console.warn("[HttpHandler] Attempted to call setupRoutes twice");
            return;
        }
        this.app.get("/health", healthRoute);
        this.app.get("/signed-download", signedDownloadRoute);
        this.app.get("/generate-signed-download", generateSignedDownloadRoute);
        this.app.get("/download", downloadRoute);
        this.app.get("/bulk-download", bulkDownloadRoute);

        this.hasInitializedRoutes = true;
    }

    private handleSocketConnection(ws: WebSocket, request: IncomingMessage) {
        const { CLIENT_PASSWORD, SERVICE_PASSWORD } = getEnvironmentVariables("manager");
        // Note: This should be impossible
        if (!this.isReady() || !request.url) {
            return void ws.close(socketClosureCodes.TooEarly);
        }
        const [type, key, address] = getSearchParamsFromPath(request.url, "type", "key", "address");
        if (!key) {
            return void ws.close(socketClosureCodes.MissingAuthentication);
        }

        if (type === "client") {
            if (key !== CLIENT_PASSWORD) {
                return void ws.close(socketClosureCodes.InvalidClientAuthentication);
            }
            const c = ClientList.register(ws);
            return;
        }

        if (!type || !address) {
            return void ws.close(socketClosureCodes.MissingServiceMetadata);
        }

        const url = cleanURL(address);
        if (!url || key !== SERVICE_PASSWORD) {
            return void ws.close(socketClosureCodes.InvalidServiceAuthentication);
        }
        // Without proper credentials, the requester should never reach this point
        // Even if an invalid service type is passed, no service is created here.
        const service = ServiceRegistry.registerAndGet(type, ws);
        if (!service) {
            return void ws.close(socketClosureCodes.FailedServiceCreation);
        }

        logInfo("[HttpHandler] New service created of type", type);
    }
}
