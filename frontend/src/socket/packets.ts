import type { PacketType, PacketTypeMap, PacketWithID } from "../../../common/packet/parser.js";
import { ListRequestPacket } from "../../../common/packet/c2s/ListRequestPacket.js";
import { PingServicesPacket } from "../../../common/packet/c2s/PingServicesPacket.js";
import { UploadQueueAddPacket } from "../../../common/packet/c2s/UploadQueueAddPacket.js";
import { ListPacket } from "../../../common/packet/s2c/ListPacket.js";
import { UploadFinishInfoPacket } from "../../../common/packet/s2c/UploadFinishInfoPacket.js";
import { UploadQueueingPacket } from "../../../common/packet/s2c/UploadQueueingPacket.js";
import { UploadQueueUpdatePacket } from "../../../common/packet/s2c/UploadQueueUpdatePacket.js";
import { UploadStartInfoPacket } from "../../../common/packet/s2c/UploadStartInfoPacket.js";

// As we cannot just scan directories, this requires manual registering

const clientboundPackets: PacketWithID<PacketTypeMap[PacketType.Server2Client]>[] = [
    ListPacket,
    UploadFinishInfoPacket,
    UploadQueueingPacket,
    UploadQueueUpdatePacket,
    UploadStartInfoPacket
];
const serverboundPackets: PacketWithID<PacketTypeMap[PacketType.Client2Server]>[] = [ListRequestPacket, PingServicesPacket, UploadQueueAddPacket];

export function getBrowserClientboundPacketList() {
    return clientboundPackets;
}

export function getBrowserServerboundPacketList() {
    return serverboundPackets;
}
