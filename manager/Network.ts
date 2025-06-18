import express, { type Express } from "express";
import http, { type IncomingMessage } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { getSearchParamsForAddress } from "./utils/url.js";
import { getEnvironmentVariables } from "../common/environment.js";
import signedDownloadMetadataRoute from "./routes/signed-download-metadata.js";
import signedDownloadRoute from "./routes/signed-download.js";
import generateSignedDownloadRoute from "./routes/generate-signed-download.js";
import downloadRoute from "./routes/download.js";
import bulkDownloadRoute from "./routes/bulk-download.js";
import healthRoute from "./routes/health.js";
import loginRoute from "./routes/login.js";
import registerRoute from "./routes/register.js";
import { ClientList } from "./client/list.js";
import { ServiceRegistry, type ServiceName } from "./services/list.js";
import { logDebug, logError } from "../common/logging.js";
import type { Duplex } from "node:stream";
import type { ServiceConfiguration } from "./services/Service.js";
import { validateObjectBySchema } from "../common/validator.js";
import { Authentication } from "./authentication.js";

type SocketName = ServiceName | "client";
interface BaseSocketParams {
    name: SocketName;
}
interface ClientSocketParams extends BaseSocketParams {
    name: "client";
    user: number;
}
interface ServiceSocketParams extends BaseSocketParams {
    name: ServiceName;
    serviceParams?: Record<string, string | null>;
}
type SocketParams = ClientSocketParams | ServiceSocketParams;

export class Network {
    private readonly server: http.Server;
    private readonly app: Express;
    private readonly wss: WebSocketServer;

    private ready: boolean = false;
    private hasInitializedRoutes: boolean = false;

    public constructor(port: number) {
        this.app = express();
        this.server = http.createServer(this.app);
        // Using verifyClient in config is not suggested: https://github.com/websockets/ws/blob/HEAD/doc/ws.md#new-websocketserveroptions-callback
        this.wss = new WebSocketServer({ noServer: true });

        /* === HTTP === */
        this.app.use(express.json());
        this.app.use((_, res, next) => {
            res.setHeader("Access-Control-Allow-Origin", "*");
            next();
        });
        this.setupRoutes();

        /* === SOCKET === */
        // Does not call the funcction directly, as that would set "this" to the server instance, not this class
        this.server.on("upgrade", (request, socket, head) => this.handleSocketUpgrade(request, socket, head));
        this.wss.on("error", (err) => console.warn("[WS Error]", err));
        this.wss.on("wsClientError", (err) => console.warn("[WS Client Error]", err));

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
            logError("Attempted to call twice");
            return;
        }
        this.app.get("/health", healthRoute);
        this.app.get("/signed-download", signedDownloadRoute);
        this.app.get("/signed-download-metadata", signedDownloadMetadataRoute);
        this.app.get("/generate-signed-download", generateSignedDownloadRoute);
        this.app.get("/download", downloadRoute);
        this.app.get("/bulk-download", bulkDownloadRoute);
        this.app.get("/login", loginRoute);
        this.app.get("/register", registerRoute);

        this.hasInitializedRoutes = true;
    }

    /**
     * This is performed before the request is actually upgraded.
     * Thus, we can destroy the connection if any parameters are invalid.
     *
     * In that way, no instances of services or clients ever get initialized
     * if anything (even the parameters an individual service requires) is invalid.
     */
    private async verifyAndGetSocketParams(request: IncomingMessage): Promise<SocketParams | null> {
        const { SERVICE_PASSWORD } = getEnvironmentVariables("manager");
        logDebug("Verifying socket:", request.url);
        if (!this.ready || !request.url) {
            return null;
        }

        const params = getSearchParamsForAddress(request.url, "type", "key");
        if (typeof params.type !== "string" || typeof params.key !== "string") {
            return null;
        }

        if (params.type === "client") {
            // Has to be async to allow for database lookup :/
            const userId = await Authentication.verifyUserToken(params.key);
            return userId ? { name: "client", user: userId } : null;
        }

        if (params.key !== SERVICE_PASSWORD) {
            return null;
        }
        const $class = ServiceRegistry.classForName(params.type);
        if ($class === null) {
            return null;
        }

        // Generic'fyd due to the individual services having "config" typed as "as const"
        const cfg = $class.getConfig() as ServiceConfiguration;
        let paramMap: Record<string, string | null> | undefined = undefined;
        if (cfg.params) {
            const params = Object.keys(cfg.params);
            paramMap = getSearchParamsForAddress(request.url, ...params);
            if (!validateObjectBySchema(paramMap, cfg.params)) {
                // We log this because it got past any authentication checks
                logError("Invalid service params for", cfg.name, " - ", request.url);
                return null;
            }
        }

        return { name: cfg.name as ServiceName, serviceParams: paramMap };
    }

    private async handleSocketUpgrade(request: IncomingMessage, duplex: Duplex, head: Buffer) {
        // The client requests an upgrade when the Connection header is set to "Upgrade".
        // Additionally, the Upgrade header is set to "websocket".
        // The server detects this and emits an "upgrade" event, which we handle here.

        const params = await this.verifyAndGetSocketParams(request);
        if (params === null) {
            // The duplex is our socket, just not yet initialized as a WebSocket instance
            duplex.destroy();
            return;
        }

        // Actually upgrades the connection and then returns a WebSocket object
        // FIXME: Fails on Bun until https://github.com/oven-sh/bun/pull/19022 is merged
        //        This is (maybe?) due to the individual paths (so including parameters) not being configured
        //        Bun replaces the "ws" package with their own BunWebSocket implementation.
        this.wss.handleUpgrade(request, duplex, head, (socket) => this.createSocketHandler(socket, request, params));
    }

    private createSocketHandler(socket: WebSocket, request: IncomingMessage, params: SocketParams) {
        if (params.name === "client") {
            // TODO: do we do anything with this object?
            const c = ClientList.register(socket, params.user);
            return;
        }

        const service = ServiceRegistry.registerAndGet(params.name, socket, params.serviceParams);
        // TODO: Should we emit a "connection" event?
        this.wss.emit("connection", socket, request);
    }
}
