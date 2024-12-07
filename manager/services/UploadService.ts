import { Service } from "./Service.ts";
import type { ServiceConfig } from "./list.ts";
import type { UploadMetadata } from "../../common/uploads.d.ts";
import type { CloseEvent, MessageEvent } from "ws";
import { UploadStartPacket } from "../../common/packet/s2u/UploadStartPacket.ts";
import { PacketType, parsePacket } from "../../common/packet/parser.ts";
import { Client } from "../Client.ts";
import { UploadFinishPacket } from "../../common/packet/u2s/UploadFinishPacket.ts";
import { UploadReadyPacket } from "../../common/packet/u2s/UploadReadyPacket.ts";
import { UploadStartInfoPacket } from "../../common/packet/s2c/UploadStartInfoPacket.ts";
import type { UUID } from "../../common";
import { UploadFinishInfoPacket } from "../../common/packet/s2c/UploadFinishInfoPacket.ts";

export class UploadService extends Service {
    /**
     * The Client this uploader is currently working with
     * @private
     */
    private clientId: UUID | null;

    public constructor(config: ServiceConfig) {
        super(config);
        this.clientId = null;
        this.initialize();
    }

    /**
     * Sends a packet to the upload service to request the start of an upload.
     *
     * Automatically informs the client of all activities.
     * @param metadata The upload metadata to send along.
     */
    public async requestUploadStart(metadata: UploadMetadata): Promise<boolean> {
        // This should not be possible when called from sendUploadsToServices
        if (this.isBusy()) {
            console.warn("[UploadService] Requested upload start while service is busy");
            return false;
        }
        this.markBusy();
        const result = await this.sendPacketAndReply(new UploadStartPacket(metadata), UploadReadyPacket);
        const data = result?.getData();

        // The client id can be trusted as it is defined by the server
        const client = Client.getClientById(metadata.client);
        // In the time awaiting a response from the uploader, the client might have disconnected
        if (!client) {
            this.markNotBusy();
            return false;
        }

        if (!data || !data.accepted) {
            this.markNotBusy();
            this.notifyClientOfFinish(false, "Uploader rejected request");
            return false;
        }

        this.clientId = metadata.client;
        const hasInformedClient = await client.sendPacket(
            new UploadStartInfoPacket({ upload_id: metadata.upload_id, chunks: data.chunks, address: this.config.address })
        );
        return hasInformedClient === null;
    }

    protected handleSocketClose(event: CloseEvent): void {
        this.notifyClientOfFinish(false, "The uploader has unexpectedly been disconnected");
    }

    protected handleSocketMessage(event: MessageEvent): void {
        const packet = parsePacket(event.data, PacketType.Uploader2Server);
        if (!packet) return;
        this.resolveReplies(packet);

        /**
         * A {@link UploadReadyPacket} is parsed directly via {@link requestUploadStart}
         * by awaiting a response.
         */

        if (packet instanceof UploadFinishPacket) {
            const { success, messages } = packet.getData();
            // TODO: Write to database
            this.notifyClientOfFinish(success);
            this.markNotBusy();
        }
    }

    private notifyClientOfFinish(success: boolean, reason?: string) {
        if (!this.clientId || !this.isBusy()) return;
        const client = Client.getClientById(this.clientId);
        if (!client) return;

        void client.sendPacket(new UploadFinishInfoPacket({ success, reason }));
        this.markNotBusy();
    }
}
