import { Service } from "./Service.ts";
import type { ServiceConfig } from "./list.ts";
import type { UploadMetadata } from "../utils/uploads.ts";
import type { CloseEvent, MessageEvent } from "ws";
import { UploadStartConfirmPacket } from "../packet/u2s/UploadStartConfirmPacket.ts";
import { UploadStartPacket } from "../packet/s2u/UploadStartPacket.ts";
import { PacketType, parsePacket } from "../utils/packets.ts";

export class UploadService extends Service {
    public constructor(config: ServiceConfig) {
        super(config);
        this.initialize();
    }

    public async requestUploadStart(metadata: UploadMetadata) {
        const result = await this.sendPacketAndReply(new UploadStartPacket(metadata), UploadStartConfirmPacket);
        console.log("Received result from uploader:", result?.getData());
    }

    protected handleSocketClose(event: CloseEvent): void {}

    protected handleSocketMessage(event: MessageEvent): void {
        const packet = parsePacket(event.data, PacketType.Uploader2Server);
        if (!packet) return;
        this.resolveReplies(packet);
    }
}
