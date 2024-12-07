import { WebSocket, type MessageEvent, type CloseEvent } from "ws";
import { PacketReceiver } from "../common/packet/PacketReceiver.ts";
import { PacketType, parsePacket } from "../common/packet/parser.ts";
import { UploadStartPacket } from "../common/packet/s2u/UploadStartPacket.ts";
import { setPendingUpload } from "./state.ts";
import type { UUID } from "../common";
import { UploadReadyPacket } from "../common/packet/u2s/UploadReadyPacket.ts";
import { generateChunkSizes } from "./file-helper.ts";
import { getEnvironmentVariables } from "../common/environment.ts";

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
