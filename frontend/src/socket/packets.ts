import type { PacketTypeMap, PacketWithID } from "../../../common/packet/definitions.js";
import { ListRequestPacket } from "../../../common/packet/c2s/ListRequestPacket.js";
import { PingServicesPacket } from "../../../common/packet/c2s/PingServicesPacket.js";
import { UploadQueueAddPacket } from "../../../common/packet/c2s/UploadQueueAddPacket.js";
import { ListPacket } from "../../../common/packet/s2c/ListPacket.js";
import { UploadFinishInfoPacket } from "../../../common/packet/s2c/UploadFinishInfoPacket.js";
import { UploadQueueingPacket } from "../../../common/packet/s2c/UploadQueueingPacket.js";
import { UploadQueueUpdatePacket } from "../../../common/packet/s2c/UploadQueueUpdatePacket.js";
import { UploadStartInfoPacket } from "../../../common/packet/s2c/UploadStartInfoPacket.js";
import { GenericBooleanPacket } from "../../../common/packet/generic/GenericBooleanPacket.js";
import PacketType from "../../../common/packet/PacketType.js";
import { FileModifyPacket } from "../../../common/packet/s2c/FileModifyPacket.js";
import { FolderModifyPacket } from "../../../common/packet/s2c/FolderModifyPacket.js";

// As we cannot just scan directories, this requires manual registering

const clientboundPackets: PacketWithID<PacketTypeMap[PacketType.Server2Client]>[] = [
    ListPacket,
    UploadFinishInfoPacket,
    UploadQueueingPacket,
    UploadQueueUpdatePacket,
    UploadStartInfoPacket,
    FileModifyPacket,
    FolderModifyPacket
];
const serverboundPackets: PacketWithID<PacketTypeMap[PacketType.Client2Server]>[] = [ListRequestPacket, PingServicesPacket, UploadQueueAddPacket];
const genericPackets: PacketWithID<PacketTypeMap[PacketType.Generic]>[] = [GenericBooleanPacket];

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
