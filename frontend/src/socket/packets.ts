import type { PacketTypeMap, PacketWithID } from "../../../common/packet/definitions.js";
import { ListPacket } from "../../../common/packet/s2c/ListPacket.js";
import { UploadFinishInfoPacket } from "../../../common/packet/s2c/UploadFinishInfoPacket.js";
import { GenericBooleanPacket } from "../../../common/packet/generic/GenericBooleanPacket.js";
import PacketType from "../../../common/packet/PacketType.js";
import { FileModifyPacket } from "../../../common/packet/s2c/FileModifyPacket.js";
import { FolderModifyPacket } from "../../../common/packet/s2c/FolderModifyPacket.js";
import { FolderStatusPacket } from "../../../common/packet/s2c/FolderStatusPacket.js";
import { ListFilesPacket } from "../../../common/packet/s2c/ListFilesPacket.js";
import { ListFoldersPacket } from "../../../common/packet/s2c/ListFoldersPacket.js";
import { GenericPrimitivesPacket } from "../../../common/packet/generic/GenericPrimitivesPacket.js";
import { UploadBookingModifyPacket } from "../../../common/packet/s2c/UploadBookingModifyPacket.js";
import { UploadResponsePacket } from "../../../common/packet/s2c/UploadResponsePacket.js";
import { UploadBookingPacket } from "../../../common/packet/s2c/UploadBookingPacket.js";
import { ServiceRegistryPacket } from "../../../common/packet/s2c/ServiceRegistryPacket.js";
import { FolderSizePacket } from "../../../common/packet/s2c/FolderSizePacket.js";
import { UploadOverwriteRequestPacket } from "../../../common/packet/s2c/UploadOverwriteRequestPacket.js";
import { UploadOverwriteCancelPacket } from "../../../common/packet/s2c/UploadOverwriteCancelPacket.js";
import { UploadStageFinishPacket } from "../../../common/packet/s2c/UploadStageFinishPacket.js";
import { SignedDownloadPacket } from "../../../common/packet/s2c/SignedDownloadPacket.js";
import { UserSearchPacket } from "../../../common/packet/s2c/UserSearchPacket.js";

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
    UploadBookingPacket,
    ServiceRegistryPacket,
    FolderSizePacket,
    UploadOverwriteRequestPacket,
    UploadOverwriteCancelPacket,
    UploadStageFinishPacket,
    SignedDownloadPacket,
    UserSearchPacket
];
const genericPackets: PacketWithID<PacketTypeMap[PacketType.Generic]>[] = [GenericBooleanPacket, GenericPrimitivesPacket];

export function getBrowserPacketList<T extends PacketType>(type: T): PacketWithID<PacketTypeMap[T]>[] {
    if (type === PacketType.Server2Client) {
        return clientboundPackets;
    } else if (type === PacketType.Generic) {
        return genericPackets;
    }
    throw new TypeError("Invalid packet type inserted into getBrowserPacketList: " + type);
}
