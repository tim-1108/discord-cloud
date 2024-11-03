import { type CloseEvent, type MessageEvent, WebSocket } from "ws";
import type { UUID } from "../common";
import { PacketType, parsePacket } from "./utils/packets.ts";
import { UploadQueueAddPacket } from "./packet/c2s/UploadQueueAddPacket.ts";
import { PacketReceiver } from "./PacketReceiver.ts";
import { enqueueUpload } from "./utils/uploads.ts";

export class Client extends PacketReceiver {
    private readonly uuid: UUID;

    public getUUID() {
        return this.uuid;
    }

    public constructor(ws: WebSocket) {
        super(ws);
        this.uuid = crypto.randomUUID();
        const success = this.initialize();
        if (success) Client.clients.set(this.uuid, this);
    }

    private static clients = new Map<UUID, Client>();

    protected handleSocketClose(event: CloseEvent) {
        Client.clients.delete(this.uuid);
    }

    protected handleSocketMessage(event: MessageEvent) {
        const packet = parsePacket(event.data, PacketType.Client2Server);
        if (!packet) return;
        const hasResolved = this.resolveReplies(packet);

        if (packet instanceof UploadQueueAddPacket) {
            enqueueUpload(this, packet);
        }
    }
}
