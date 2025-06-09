import { WebSocket, type MessageEvent, type CloseEvent } from "ws";
import { PacketReceiver } from "../common/packet/PacketReceiver.js";
import { parsePacket } from "../common/packet/parser.js";
import { getEnvironmentVariables } from "../common/environment.js";
import { getServersidePacketList } from "../common/packet/reader.js";
import { GenThumbnailPacket } from "../common/packet/s2t/GenThumbnailPacket.js";
import { processThumbnailRequest } from "./index.js";
import PacketType from "../common/packet/PacketType.js";

export class Socket extends PacketReceiver {
    public constructor() {
        const env = getEnvironmentVariables("thumbnail-service");
        const address = new URL(env.MANAGER_ADDRESS);
        address.searchParams.append("type", "thumbnail");
        address.searchParams.append("key", env.SERVICE_PASSWORD);

        const socket = new WebSocket(address);
        super(socket);
        socket.onopen = () => this.handleSocketOpen();
    }

    protected handleSocketOpen() {
        console.log("This socket is now open");
    }

    protected handleSocketClose(event: CloseEvent) {
        console.log("This socket is now closed", event.code, event.reason);
        process.exit(1);
    }

    protected handleSocketMessage(event: MessageEvent) {
        const packet = parsePacket(event.data, PacketType.Server2Thumbnail, getServersidePacketList);
        if (!packet) return;
        this.resolveReplies(packet);

        if (packet instanceof GenThumbnailPacket) {
            return void processThumbnailRequest(packet);
        }
    }
}
