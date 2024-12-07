import { WebSocket, type MessageEvent, type CloseEvent } from "ws";
import { PacketReceiver } from "../common/packet/PacketReceiver";
import { PacketType, parsePacket } from "../common/packet/parser";
import { UploadStartPacket } from "../common/packet/s2u/UploadStartPacket";
import { setPendingUpload } from "./state";
import type { UUID } from "../common";
import { UploadReadyPacket } from "../common/packet/u2s/UploadReadyPacket";
import { generateChunkSizes } from "./file-helper";
import { getEnvironmentVariables } from "../common/environment";

export class Socket extends PacketReceiver {
    public constructor() {
        const env = getEnvironmentVariables("upload-service");
        const address = new URL(env.MANAGER_ADDRESS);
        address.searchParams.append("type", "upload");
        address.searchParams.append("key", env.PASSWORD);
        address.searchParams.append("address", env.OWN_ADDRESS);

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
        process.exit(1);
    }

    protected handleSocketMessage(event: MessageEvent) {
        const packet = parsePacket(event.data, PacketType.Server2Uploader);
        if (!packet) return;
        this.resolveReplies(packet);

        if (packet instanceof UploadStartPacket) {
            const { upload_id, client, ...data } = packet.getData();
            const chunks = generateChunkSizes(data.size);
            const accepted = setPendingUpload({ ...data, upload_id: upload_id as UUID, client: client as UUID }, chunks);
            this.replyToPacket(packet, new UploadReadyPacket({ accepted, chunks }));
        }
    }
}
