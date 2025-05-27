import { Service, type ServiceParams } from "./Service.js";
import type { UploadMetadata } from "../../common/uploads.js";
import type { CloseEvent, MessageEvent, WebSocket } from "ws";
import { UploadStartPacket } from "../../common/packet/s2u/UploadStartPacket.js";
import { parsePacket } from "../../common/packet/parser.js";
import { UploadFinishPacket } from "../../common/packet/u2s/UploadFinishPacket.js";
import { UploadReadyPacket } from "../../common/packet/u2s/UploadReadyPacket.js";
import { UploadStartInfoPacket } from "../../common/packet/s2c/UploadStartInfoPacket.js";
import { failUpload, finishUpload, sendUploadsToServices } from "../uploads.js";
import { getServersidePacketList } from "../../common/packet/reader.js";
import { ClientList } from "../client/list.js";
import { logWarn } from "../../common/logging.js";
import PacketType from "../../common/packet/PacketType.js";

const config = {
    name: "upload",
    params: {
        address: { type: "string", required: true, validator_function: validateTargetAddress }
    }
} as const;

function validateTargetAddress(value: any) {
    if (typeof value !== "string") return false;
    try {
        // The manager itself will never contact this url, this is only provided to clients.
        // Thus, anything can really be entered here. Any services created we assume we can trust.
        const url = new URL(value);
        return ["http:", "https:"].includes(url.protocol);
    } catch {
        return false;
    }
}

export class UploadService extends Service {
    public addHandler(): void {
        sendUploadsToServices();
    }
    public removeHandler(): void {
        if (this.uploadMetadata) {
            failUpload(this.uploadMetadata, "The uploader has unexpectedly disconnected");
        }
    }
    public config = config;
    public static getConfig() {
        return config;
    }

    private uploadMetadata: UploadMetadata | null;
    private address: string;

    public constructor(socket: WebSocket, params?: ServiceParams<UploadService>) {
        super(socket, params);
        this.uploadMetadata = null;
        /**
         * The internal _url within WebSocket is retrieved
         * from a URL object's href, thus has to be valid.
         */
        if (!params || !params.address) {
            throw new ReferenceError("Validation for UploadService params somehow failed...");
        }
        this.address = params.address;
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
            logWarn("Requested upload start while service is busy");
            return false;
        }
        this.markBusy();
        const { is_overwriting_id, ...rest } = metadata;
        const result = await this.sendPacketAndReply(new UploadStartPacket(rest), UploadReadyPacket);
        const data = result?.getData();

        // The client id can be trusted as it is defined by the server
        const client = ClientList.get(metadata.client);

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
            new UploadStartInfoPacket({ upload_id: metadata.upload_id, chunks: data.chunks, address: this.address })
        );

        return hasInformedClient === null;
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
