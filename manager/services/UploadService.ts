import { Service, type ServiceParams } from "./Service.js";
import type { UploadMetadata } from "../../common/uploads.js";
import type { MessageEvent, WebSocket } from "ws";
import { UploadStartPacket } from "../../common/packet/s2u/UploadStartPacket.js";
import { parsePacket } from "../../common/packet/parser.js";
import { UploadFinishPacket } from "../../common/packet/u2s/UploadFinishPacket.js";
import { getServersidePacketList } from "../../common/packet/reader.js";
import { ClientList } from "../client/list.js";
import PacketType from "../../common/packet/PacketType.js";
import { Uploads } from "../uploads.js";
import type { DataErrorFields, UUID } from "../../common/index.js";
import type { Client } from "../client/Client.js";
import { GenericBooleanPacket } from "../../common/packet/generic/GenericBooleanPacket.js";
import { logError, logInfo, logWarn } from "../../common/logging.js";
import { UploadAbortPacket } from "../../common/packet/s2u/UploadAbortPacket.js";

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
        Uploads.handlers.service.initOrRelease(this);
    }
    public removeHandler(): void {
        if (this.booking) {
            Uploads.handlers.service.disconnect(this.booking);
        }
        if (this.uploadMetadata) {
            Uploads.finish(this.uploadMetadata, "The upload service disconnected");
        }
    }
    public config = config;
    public static getConfig() {
        return config;
    }

    private uploadMetadata: UploadMetadata | null;
    private address: string;
    private booking: UUID | null;

    public constructor(socket: WebSocket, params?: ServiceParams<UploadService>) {
        super(socket, params);
        this.uploadMetadata = null;
        this.booking = null;
        /**
         * The internal _url within WebSocket is retrieved
         * from a URL object's href, thus has to be valid.
         */
        if (!params || !params.address) {
            throw new ReferenceError("Validation for UploadService params somehow failed...");
        }
        this.address = params.address;
    }

    public getAddress() {
        return this.address;
    }

    public bookForClient(client: Client) {
        this.booking = client.getUUID();
    }

    public isBookedForClient(client: Client): boolean {
        return this.booking === client.getUUID();
    }

    public clearBooking() {
        if (this.uploadMetadata !== null) {
            throw new Error("Before clearing booking, first abort the upload");
        }
        this.booking = null;
    }

    public isBooked(): boolean {
        return this.booking !== null;
    }

    public getUploadTaskUUID(): UUID | null {
        if (!this.uploadMetadata) return null;
        return this.uploadMetadata.upload_id;
    }

    public async abortUpload(): Promise<{ error: false; metadata: UploadMetadata | undefined } | { error: true }> {
        if (!this.uploadMetadata) {
            return { error: false, metadata: undefined };
        }
        // log moved here because on every service free, this function is called
        // (even when reshuffling uploaders because the client is now done uploading)
        logInfo("Called for abort on:", this.address);
        const result = await this.sendPacketAndReply_new(new UploadAbortPacket({}), GenericBooleanPacket);
        if (!result.packet) {
            logInfo(`Failed to request upload abort at ${this.address}: ${result.error}`);
            return { error: true };
        }
        // Should we really be clearing this here if something has gone wrong?
        const data = result.packet.getData();

        if (!data.success) {
            // In this case, best kill the uploader!
            logError("Failed to abort upload due to:", data.message ?? "Unspecified reason");
            return { error: true };
        } else {
            const um = this.uploadMetadata;
            this.markNotBusy();
            this.uploadMetadata = null;
            return { error: false, metadata: um };
        }
    }

    /**
     * Sends a packet to the upload service to request the start of an upload.
     *
     * Automatically informs the client of all activities.
     * @param metadata The upload metadata to send along.
     */
    public async requestUploadStart(metadata: UploadMetadata): Promise<DataErrorFields<boolean>> {
        const { desired_name: name, path, size, upload_id, chunk_size } = metadata;
        this.markBusy();
        const result = await this.sendPacketAndReply_new(
            new UploadStartPacket({ name, path, size, upload_id, chunk_size, client: metadata.client }),
            GenericBooleanPacket
        );
        if (!result.packet) {
            logInfo(`Failed to submit upload to ${this.address}: ${result.error}`);
            this.markNotBusy();
            return { error: result.error, data: null };
        }

        // The client id can be trusted as it is defined by the server
        const client = ClientList.get(metadata.client);

        // In the time awaiting a response from the uploader, the client might have disconnected
        if (!client) {
            this.markNotBusy();
            return { error: "Client disconnected", data: null };
        }

        const { success, message } = result.packet.getData();
        if (!success) {
            this.markNotBusy();
            if (!message) {
                logWarn("The upload service did not specify a reason for upload rejection. Please update me!");
            }
            return { error: message ?? "The service rejected the upload for an unspecified reason", data: null };
        }

        this.uploadMetadata = metadata;
        return { data: true, error: null };
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
                logWarn(`Received a finish packet when no upload was marked for this service (service ${this.getServiceUUID()}):`, packet.getData());
                return;
            }
            this.markNotBusy();
            Uploads.finish(this.uploadMetadata, packet);
            this.uploadMetadata = null;
        }
    }
}
