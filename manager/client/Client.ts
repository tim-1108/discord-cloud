import { type CloseEvent, type MessageEvent, WebSocket } from "ws";
import type { UUID } from "../../common/index.js";
import { parsePacket } from "../../common/packet/parser.js";
import { PacketReceiver } from "../../common/packet/PacketReceiver.js";
import { PingServicesPacket } from "../../common/packet/c2s/PingServicesPacket.js";
import { pingServices } from "../pinging.js";
import { ListRequestPacket } from "../../common/packet/c2s/ListRequestPacket.js";
import { ListingClientOperations } from "../client-operations/listing.js";
import { getServersidePacketList } from "../../common/packet/reader.js";
import PacketType from "../../common/packet/PacketType.js";
import { Uploads } from "../uploads.js";
import { CreateFolderPacket } from "../../common/packet/c2s/CreateFolderPacket.js";
import { ThumbnailRequestPacket } from "../../common/packet/c2s/ThumbnailRequestPacket.js";
import { performThumbnailRequestOperation } from "../client-operations/thumbnail.js";
import { ActionClientOperations } from "../client-operations/actions.js";
import { DeleteFilePacket } from "../../common/packet/c2s/DeleteFilePacket.js";
import { MoveFilesPacket } from "../../common/packet/c2s/MoveFilesPacket.js";
import { RenameFolderPacket } from "../../common/packet/c2s/RenameFolderPacket.js";
import { RenameFilePacket } from "../../common/packet/c2s/RenameFilePacket.js";
import { ClientList } from "./list.js";
import { FolderStatusRequestPacket } from "../../common/packet/c2s/FolderStatusRequestPacket.js";
import { UploadRequestPacket } from "../../common/packet/c2s/UploadRequestPacket.js";
import { UploadServicesRequestPacket } from "../../common/packet/c2s/UploadServicesRequestPacket.js";
import { UploadServicesReleasePacket } from "../../common/packet/c2s/UploadServicesReleasePacket.js";
import { logInfo } from "../../common/logging.js";
import { FolderSizeRequestPacket } from "../../common/packet/c2s/FolderSizeRequestPacket.js";

export class Client extends PacketReceiver {
    private readonly uuid: UUID;
    private readonly userId: number;

    public getUserId() {
        return this.userId;
    }

    public getUUID() {
        return this.uuid;
    }

    public constructor(ws: WebSocket, userId: number) {
        super(ws);
        this.uuid = crypto.randomUUID();
        this.userId = userId;
        // To get all services online once a client connects,
        // they are also pinged here.
        pingServices();
        console.info(`[Client.constructor] ${this.uuid} initialized`);
    }

    // TODO: Whenever a client disconnects, also force the uploader (if one is connected to this client)
    //  to close any in-progress uploads
    protected handleSocketClose(event: CloseEvent) {
        ClientList.unregister(this);
        Uploads.handlers.client.disconnect(this);
        logInfo(`Client disconnect: ${this.uuid}`);
    }

    protected handleSocketMessage(event: MessageEvent) {
        const packet = parsePacket(event.data, PacketType.Client2Server, getServersidePacketList);
        if (!packet) return;
        const hasResolved = this.resolveReplies(packet);

        if (packet instanceof UploadRequestPacket) {
            void Uploads.request(this, packet);
        } else if (packet instanceof PingServicesPacket) {
            pingServices();
        } else if (packet instanceof ListRequestPacket) {
            void ListingClientOperations.listRequest(this, packet);
        } else if (packet instanceof FolderStatusRequestPacket) {
            void ListingClientOperations.folderStatus(this, packet);
        } else if (packet instanceof CreateFolderPacket) {
            void ActionClientOperations.createFolder(this, packet);
        } else if (packet instanceof ThumbnailRequestPacket) {
            void performThumbnailRequestOperation(this, packet);
        } else if (packet instanceof DeleteFilePacket) {
            void ActionClientOperations.deleteFile(this, packet);
        } else if (packet instanceof MoveFilesPacket) {
            void ActionClientOperations.moveFiles(this, packet);
        } else if (packet instanceof RenameFolderPacket) {
            void ActionClientOperations.renameFolder(this, packet);
        } else if (packet instanceof RenameFilePacket) {
            void ActionClientOperations.renameFile(this, packet);
        } else if (packet instanceof UploadServicesRequestPacket) {
            void Uploads.booking.request(this, packet);
        } else if (packet instanceof UploadServicesReleasePacket) {
            void Uploads.booking.release(this, packet);
        } else if (packet instanceof FolderSizeRequestPacket) {
            void ListingClientOperations.folderSize(this, packet);
        }
    }
}
