import type { PacketTypeMap, PacketWithID } from "../../../common/packet/definitions.js";
import { ListRequestPacket } from "../../../common/packet/c2s/ListRequestPacket.js";
import { PingServicesPacket } from "../../../common/packet/c2s/PingServicesPacket.js";
import { ListPacket } from "../../../common/packet/s2c/ListPacket.js";
import { UploadFinishInfoPacket } from "../../../common/packet/s2c/UploadFinishInfoPacket.js";
import { GenericBooleanPacket } from "../../../common/packet/generic/GenericBooleanPacket.js";
import PacketType from "../../../common/packet/PacketType.js";
import { FileModifyPacket } from "../../../common/packet/s2c/FileModifyPacket.js";
import { FolderModifyPacket } from "../../../common/packet/s2c/FolderModifyPacket.js";
import { DeleteFilePacket } from "../../../common/packet/c2s/DeleteFilePacket.js";
import { DeleteFolderPacket } from "../../../common/packet/c2s/DeleteFolderPacket.js";
import { MoveFilesPacket } from "../../../common/packet/c2s/MoveFilesPacket.js";
import { CreateFolderPacket } from "../../../common/packet/c2s/CreateFolderPacket.js";
import { RenameFolderPacket } from "../../../common/packet/c2s/RenameFolderPacket.js";
import { RenameFilePacket } from "../../../common/packet/c2s/RenameFilePacket.js";
import { ThumbnailRequestPacket } from "../../../common/packet/c2s/ThumbnailRequestPacket.js";
import { FolderStatusPacket } from "../../../common/packet/s2c/FolderStatusPacket.js";
import { ListFilesPacket } from "../../../common/packet/s2c/ListFilesPacket.js";
import { ListFoldersPacket } from "../../../common/packet/s2c/ListFoldersPacket.js";
import { GenericPrimitivesPacket } from "../../../common/packet/generic/GenericPrimitivesPacket.js";
import { UploadRequestPacket } from "../../../common/packet/c2s/UploadRequestPacket.js";
import { UploadServicesReleasePacket } from "../../../common/packet/c2s/UploadServicesReleasePacket.js";
import { UploadServicesRequestPacket } from "../../../common/packet/c2s/UploadServicesRequestPacket.js";
import { UploadBookingModifyPacket } from "../../../common/packet/s2c/UploadBookingModifyPacket.js";
import { UploadResponsePacket } from "../../../common/packet/s2c/UploadResponsePacket.js";
import { UploadServicesPacket } from "../../../common/packet/s2c/UploadServicesPacket.js";

// As we cannot just scan directories, this requires manual registering

const clientboundPackets: PacketWithID<PacketTypeMap[PacketType.Server2Client]>[] = [
    ListPacket,
    UploadFinishInfoPacket,
    FileModifyPacket,
    FolderModifyPacket,
    FolderStatusPacket,
    ListFilesPacket,
    ListFoldersPacket,
    UploadBookingModifyPacket,
    UploadResponsePacket,
    UploadServicesPacket
];
const serverboundPackets: PacketWithID<PacketTypeMap[PacketType.Client2Server]>[] = [
    ListRequestPacket,
    PingServicesPacket,
    DeleteFilePacket,
    DeleteFolderPacket,
    MoveFilesPacket,
    CreateFolderPacket,
    RenameFolderPacket,
    RenameFilePacket,
    ThumbnailRequestPacket,
    UploadRequestPacket,
    UploadServicesReleasePacket,
    UploadServicesRequestPacket
];
const genericPackets: PacketWithID<PacketTypeMap[PacketType.Generic]>[] = [GenericBooleanPacket, GenericPrimitivesPacket];

export function getBrowserPacketList<T extends PacketType>(type: T): PacketWithID<PacketTypeMap[T]>[] {
    if (type === PacketType.Client2Server) {
        return serverboundPackets;
    } else if (type === PacketType.Server2Client) {
        return clientboundPackets;
    } else if (type === PacketType.Generic) {
        return genericPackets;
    }
    throw new TypeError("Invalid packet type inserted into getBrowserPacketList: " + type);
}
