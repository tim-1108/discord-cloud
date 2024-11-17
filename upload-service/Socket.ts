import { WebSocket, type MessageEvent, type CloseEvent } from "ws";
import { getEnviromentVariables } from "./index.ts";
import { PacketReceiver } from "../common/packet/PacketReceiver.ts";
import { PacketType, parsePacket } from "../common/packet/parser.ts";
import { UploadStartPacket } from "../common/packet/s2u/UploadStartPacket.ts";
import { UploadStartConfirmPacket } from "../common/packet/u2s/UploadStartConfirmPacket.ts";
import { setPendingUpload } from "./state.ts";
import type { UUID } from "../common";

export class Socket extends PacketReceiver {
    public constructor() {
        const env = getEnviromentVariables();
        const address = new URL(env.socketAddress);
        address.searchParams.append("type", "upload");
        address.searchParams.append("key", env.password);
        address.searchParams.append("address", env.address);

        const socket = new WebSocket(address);
        super(socket);
        socket.onopen = () => this.handleSocketOpen();
    }

    protected handleSocketOpen() {
        console.log("This socket is now open");
        this.initialize();
    }

    protected handleSocketClose(event: CloseEvent) {
        console.log("This socket is now closed");
    }

    protected handleSocketMessage(event: MessageEvent) {
        const packet = parsePacket(event.data, PacketType.Server2Uploader);
        if (!packet) return;
        this.resolveReplies(packet);

        if (packet instanceof UploadStartPacket) {
            const { upload_id, client, ...data } = packet.getData();
            const accepted = setPendingUpload({ ...data, upload_id: upload_id as UUID, client: client as UUID });
            this.replyToPacket(packet, new UploadStartConfirmPacket({ accepted }));
        }
    }
}
