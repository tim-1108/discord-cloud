import { Service } from "./Service";
import type { ServiceConfig } from "./list";
import type { UploadMetadata } from "../../common/uploads";
import type { CloseEvent, MessageEvent } from "ws";
import { UploadStartPacket } from "../../common/packet/s2u/UploadStartPacket";
import { PacketType, parsePacket } from "../../common/packet/parser";
import { Client } from "../Client";
import { UploadFinishPacket } from "../../common/packet/u2s/UploadFinishPacket";
import { UploadReadyPacket } from "../../common/packet/u2s/UploadReadyPacket";
import { UploadStartInfoPacket } from "../../common/packet/s2c/UploadStartInfoPacket";
import { failUpload, finishUpload } from "../uploads";

export class UploadService extends Service {
    private uploadMetadata: UploadMetadata | null;

    public constructor(config: ServiceConfig) {
        super(config);
        this.uploadMetadata = null;
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
        const packet = parsePacket(event.data, PacketType.Uploader2Server);
        if (!packet) return;
        console.info(`[UploadService] Received packet ${packet.id} with data`, packet.getData());
        const hasResolved = this.resolveReplies(packet);
        console.info(`[UploadService] Resolved replies: ${hasResolved}`);

        /**
         * A {@link UploadReadyPacket} is parsed directly via {@link requestUploadStart}
         * by awaiting a response.
         */

        if (packet instanceof UploadFinishPacket) {
            if (!this.uploadMetadata) {
                console.warn("[UploadService] Received a finish packet when no upload was marked for this service");
                return;
            }
            const { success, messages, hash, is_encrypted, reason, type } = packet.getData();
            // TODO: Remove manual validation
            this.markNotBusy();
            if (success && Array.isArray(messages) && typeof hash === "string" && typeof is_encrypted === "boolean" && typeof type === "string") {
                finishUpload(this.uploadMetadata, messages, is_encrypted, hash, type);
            } else {
                failUpload(this.uploadMetadata, reason);
            }
            this.uploadMetadata = null;
        }
    }
}
