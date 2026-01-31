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
import { ServiceRegistry } from "../services/list.js";
import { ServiceRegistryPacket } from "../../common/packet/s2c/ServiceRegistryPacket.js";
import { UploadService } from "../services/UploadService.js";
import { sleep } from "../../common/useless.js";
import { UploadAbortRequestPacket } from "../../common/packet/c2s/UploadAbortRequestPacket.js";

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

        logInfo("Connected:", this.userId, this.uuid);
        pingServices();
        this.socket.readyState === this.socket.OPEN
            ? this.emitServiceRegistryList()
            : this.socket.addEventListener("open", () => this.emitServiceRegistryList());
    }

    private async emitServiceRegistryList() {
        // FIXME: When the socket opens, and says it IS OPEN, why do packets
        //        still not go through? Same thing goes for the thumbnail service queue.
        await sleep(0);
        for (const type of ServiceRegistry.typeNames()) {
            const arr = ServiceRegistry.predicatedList(type);
            for (const service of arr) {
                // The "address" field is only passed on upload services
                const address = service instanceof UploadService ? service.getAddress() : undefined;
                this.sendPacket(new ServiceRegistryPacket({ action: "list", service_type: type, service_uuid: service.getServiceUUID(), address }));
            }
        }
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
        } else if (packet instanceof UploadAbortRequestPacket) {
            void Uploads.handlers.client.requestAbort(this, packet);
        }
    }
}
