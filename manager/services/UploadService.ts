import { Service } from "./Service.ts";
import type { ServiceConfig } from "./list.ts";
import type { UploadMetadataClientProvided } from "../../common/uploads.d.ts";
import type { CloseEvent, MessageEvent } from "ws";
import { UploadStartConfirmPacket } from "../../common/packet/u2s/UploadStartConfirmPacket.ts";
import { UploadStartPacket } from "../../common/packet/s2u/UploadStartPacket.ts";
import { PacketType, parsePacket } from "../../common/packet/parser.ts";
import { Client } from "../Client.ts";

export class UploadService extends Service {
    public constructor(config: ServiceConfig) {
        super(config);
        this.initialize();
    }

    public async requestUploadStart(metadata: UploadMetadataClientProvided) {
        // This should not be possible when called from sendUploadsToServices
        if (this.isBusy()) {
            console.warn("[UploadService] Requested upload start while service is busy");
            return;
        }
        this.markBusy();
        const id = crypto.randomUUID();
        const result = await this.sendPacketAndReply(new UploadStartPacket({ ...metadata, upload_id: id }), UploadStartConfirmPacket);
        const accepted = result?.getData().accepted;

        const client = Client.getClientById(metadata.client);
        // In the time awaiting a response from the uploader, the client might have disconnected
        if (!client) {
            this.markNotBusy();
            return;
        }

        if (!accepted) {
            this.markNotBusy();
            //client.sendPacket()
            return;
        }
    }

    protected handleSocketClose(event: CloseEvent): void {}

    protected handleSocketMessage(event: MessageEvent): void {
        const packet = parsePacket(event.data, PacketType.Uploader2Server);
        if (!packet) return;
        this.resolveReplies(packet);
    }
}
