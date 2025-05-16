import { Service } from "./Service.js";
import type { ServiceConfig } from "./list.js";
import type { UploadMetadata } from "../../common/uploads.js";
import type { CloseEvent, MessageEvent } from "ws";
import { UploadStartPacket } from "../../common/packet/s2u/UploadStartPacket.js";
import { PacketType, parsePacket } from "../../common/packet/parser.js";
import { Client } from "../client/Client.js";
import { UploadFinishPacket } from "../../common/packet/u2s/UploadFinishPacket.js";
import { UploadReadyPacket } from "../../common/packet/u2s/UploadReadyPacket.js";
import { UploadStartInfoPacket } from "../../common/packet/s2c/UploadStartInfoPacket.js";
import { failUpload, finishUpload } from "../uploads.js";
import { getServersidePacketList } from "../../common/packet/reader.js";

export class UploadService extends Service {
    private uploadMetadata: UploadMetadata | null;

    public constructor(config: ServiceConfig) {
        super(config);
        this.uploadMetadata = null;
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
        const { is_overwriting_id, ...rest } = metadata;
        const result = await this.sendPacketAndReply(new UploadStartPacket(rest), UploadReadyPacket);
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
            failUpload(metadata, "The service rejected the upload");
            return false;
        }

        this.uploadMetadata = metadata;
        const hasInformedClient = await client.sendPacket(
            new UploadStartInfoPacket({ upload_id: metadata.upload_id, chunks: data.chunks, address: this.config.address })
        );

        return hasInformedClient === null;
    }

    protected handleSocketClose(event: CloseEvent): void {
        if (!this.uploadMetadata) return;
        failUpload(this.uploadMetadata, "The uploader has unexpectedly disconnected");
        this.uploadMetadata = null;
    }

    protected handleSocketMessage(event: MessageEvent): void {
        const packet = parsePacket(event.data, PacketType.Uploader2Server, getServersidePacketList);
        if (!packet) return;
        const hasResolved = this.resolveReplies(packet);
        if (hasResolved) return;

        /**
         * A {@link UploadReadyPacket} is parsed directly via {@link requestUploadStart}
         * by awaiting a response.
         */

        if (packet instanceof UploadFinishPacket) {
            if (!this.uploadMetadata) {
                console.warn("[UploadService] Received a finish packet when no upload was marked for this service");
                return;
            }
            const { success, reason } = packet.getData();
            // TODO: Remove manual validation
            this.markNotBusy();
            if (success) {
                void finishUpload(this.uploadMetadata, packet);
            } else {
                failUpload(this.uploadMetadata, reason);
            }
            this.uploadMetadata = null;
        }
    }
}
