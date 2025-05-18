import { type CloseEvent, type MessageEvent, WebSocket } from "ws";
import type { UUID } from "../../common/index.js";
import { parsePacket } from "../../common/packet/parser.js";
import { UploadQueueAddPacket } from "../../common/packet/c2s/UploadQueueAddPacket.js";
import { PacketReceiver } from "../../common/packet/PacketReceiver.js";
import { performEnqueueUploadOperation, removeClientItemsFromQueue } from "../uploads.js";
import { PingServicesPacket } from "../../common/packet/c2s/PingServicesPacket.js";
import { pingServices } from "../pinging.js";
import { ListRequestPacket } from "../../common/packet/c2s/ListRequestPacket.js";
import { performListPacketOperation } from "../client-operations/listing.js";
import { getServersidePacketList } from "../../common/packet/reader.js";
import { PacketType } from "../../common/packet/definitions.js";

export class Client extends PacketReceiver {
    private readonly uuid: UUID;

    public getUUID() {
        return this.uuid;
    }

    public constructor(ws: WebSocket) {
        super(ws);
        this.uuid = crypto.randomUUID();
        this.initialize();
        // To get all services online once a client connects,
        // they are also pinged here.
        pingServices();
        console.info(`[Client.constructor] ${this.uuid} initialized`);
    }

    // TODO: Whenever a client disconnects, also force the uploader (if one is connected to this client)
    //  to close any in-progress uploads
    protected handleSocketClose(event: CloseEvent) {
        const clearedUploads = removeClientItemsFromQueue(this.uuid);
        console.info(`[Client.disconnect] ${this.uuid} | Removed ${clearedUploads} queued upload(s)`);
    }

    protected handleSocketMessage(event: MessageEvent) {
        const packet = parsePacket(event.data, PacketType.Client2Server, getServersidePacketList);
        if (!packet) return;
        const hasResolved = this.resolveReplies(packet);

        if (packet instanceof UploadQueueAddPacket) {
            performEnqueueUploadOperation(this, packet);
        } else if (packet instanceof PingServicesPacket) {
            pingServices();
        } else if (packet instanceof ListRequestPacket) {
            void performListPacketOperation(this, packet);
        }
    }
}
