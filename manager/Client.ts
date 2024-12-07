import { type CloseEvent, type MessageEvent, WebSocket } from "ws";
import type { UUID } from "../common";
import { PacketType, parsePacket } from "../common/packet/parser";
import { UploadQueueAddPacket } from "../common/packet/c2s/UploadQueueAddPacket";
import { PacketReceiver } from "../common/packet/PacketReceiver";
import { enqueueUpload, removeClientItemsFromQueue } from "./uploads";
import { PingServicesPacket } from "../common/packet/c2s/PingServicesPacket";
import { pingServices } from "./pinging";

export class Client extends PacketReceiver {
    private readonly uuid: UUID;

    public getUUID() {
        return this.uuid;
    }

    public constructor(ws: WebSocket) {
        super(ws);
        this.uuid = crypto.randomUUID();
        const success = this.initialize();
        if (success) {
            Client.clients.set(this.uuid, this);
            // To get all services online once a client connects,
            // they are also pinged here.
            pingServices();
        }
        console.info(`[Client.constructor] ${this.uuid} initialized with`, success);
    }

    private static clients = new Map<UUID, Client>();

    public static getClientById(id: UUID) {
        return Client.clients.get(id);
    }

    // TODO: Whenever a client disconnects, also force the uploader (if one is connected to this client)
    //  to close any in-progress uploads
    protected handleSocketClose(event: CloseEvent) {
        Client.clients.delete(this.uuid);
        const clearedUploads = removeClientItemsFromQueue(this.uuid);
        console.info(`[Client.disconnect] ${this.uuid} | Removed ${clearedUploads} queued upload(s)`);
    }

    protected handleSocketMessage(event: MessageEvent) {
        const packet = parsePacket(event.data, PacketType.Client2Server);
        if (!packet) return;
        const hasResolved = this.resolveReplies(packet);

        if (packet instanceof UploadQueueAddPacket) {
            enqueueUpload(this, packet);
        } else if (packet instanceof PingServicesPacket) {
            pingServices();
        }
    }
}
