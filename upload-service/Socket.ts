import { WebSocket, type MessageEvent, type CloseEvent } from "ws";
import { PacketReceiver } from "../common/packet/PacketReceiver.js";
import { parsePacket } from "../common/packet/parser.js";
import { UploadStartPacket } from "../common/packet/s2u/UploadStartPacket.js";
import { getEnvironmentVariables } from "../common/environment.js";
import { getServersidePacketList } from "../common/packet/reader.js";
import PacketType from "../common/packet/PacketType.js";
import { UploadAbortPacket } from "../common/packet/s2u/UploadAbortPacket.js";
import { Upload } from "./index.js";

export class Socket extends PacketReceiver {
    public constructor() {
        const env = getEnvironmentVariables("upload-service");
        const address = new URL(env.MANAGER_ADDRESS);
        address.searchParams.append("type", "upload");
        address.searchParams.append("key", env.SERVICE_PASSWORD);
        address.searchParams.append("address", env.OWN_ADDRESS);

        const socket = new WebSocket(address);
        super(socket);
        socket.onopen = () => this.handleSocketOpen();
    }

    protected handleSocketOpen() {
        console.log("This socket is now open");
    }

    protected handleSocketClose(event: CloseEvent) {
        console.log("This socket is now closed");
        process.exit(1);
    }

    protected handleSocketMessage(event: MessageEvent) {
        const packet = parsePacket(event.data, PacketType.Server2Uploader, getServersidePacketList);
        if (!packet) return;
        this.resolveReplies(packet);

        if (packet instanceof UploadStartPacket) {
            Upload.packet.start(packet);
        } else if (packet instanceof UploadAbortPacket) {
            Upload.packet.abort(packet);
        } else {
            throw new TypeError("You forgot to handle a packet class within Socket.ts!");
        }
    }
}
