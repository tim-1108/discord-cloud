import { type CloseEvent, type MessageEvent, WebSocket } from "ws";
import type { UUID } from "../../common/index.js";
import { parsePacket } from "../../common/packet/parser.js";
import { UploadQueueAddPacket } from "../../common/packet/c2s/UploadQueueAddPacket.js";
import { PacketReceiver } from "../../common/packet/PacketReceiver.js";
import { PingServicesPacket } from "../../common/packet/c2s/PingServicesPacket.js";
import { pingServices } from "../pinging.js";
import { ListRequestPacket } from "../../common/packet/c2s/ListRequestPacket.js";
import { performListPacketOperation } from "../client-operations/listing.js";
import { getServersidePacketList } from "../../common/packet/reader.js";
import PacketType from "../../common/packet/PacketType.js";
import { Uploads } from "../uploads.js";
import { CreateFolderPacket } from "../../common/packet/c2s/CreateFolderPacket.js";
import { ThumbnailRequestPacket } from "../../common/packet/c2s/ThumbnailRequestPacket.js";
import { performThumbnailRequestOperation } from "../client-operations/thumbnail.js";

export class Client extends PacketReceiver {
    private readonly uuid: UUID;
    private readonly userId: number;

    public getUserId() {
        return this.userId;
    }

    public getUUID() {
        return this.uuid;
    }

    public constructor(ws: WebSocket, userId: number) {
        super(ws);
        this.uuid = crypto.randomUUID();
        this.userId = userId;
        // To get all services online once a client connects,
        // they are also pinged here.
        pingServices();
        console.info(`[Client.constructor] ${this.uuid} initialized`);
    }

    // TODO: Whenever a client disconnects, also force the uploader (if one is connected to this client)
    //  to close any in-progress uploads
    protected handleSocketClose(event: CloseEvent) {
        const clearedUploads = Uploads.clear.client(this.uuid);
        console.info(`[Client.disconnect] ${this.uuid} | Removed ${clearedUploads} queued upload(s)`);
    }

    protected handleSocketMessage(event: MessageEvent) {
        const packet = parsePacket(event.data, PacketType.Client2Server, getServersidePacketList);
        if (!packet) return;
        const hasResolved = this.resolveReplies(packet);

        if (packet instanceof UploadQueueAddPacket) {
            Uploads.enqueue(this, packet);
        } else if (packet instanceof PingServicesPacket) {
            pingServices();
        } else if (packet instanceof ListRequestPacket) {
            void performListPacketOperation(this, packet);
        } else if (packet instanceof CreateFolderPacket) {
        } else if (packet instanceof ThumbnailRequestPacket) {
            void performThumbnailRequestOperation(this, packet);
        }
    }
}
