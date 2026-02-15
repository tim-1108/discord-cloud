import type { UUID } from "../index.js";
import { C2SPacket } from "./C2SPacket.js";
import { GenericPacket } from "./GenericPacket.js";
import type { Packet } from "./Packet.js";
import PacketType from "./PacketType.js";
import { S2CPacket } from "./S2CPacket.js";
import { S2TPacket } from "./S2TPacket.js";
import { S2UPacket } from "./S2UPacket.js";
import { T2SPacket } from "./T2SPacket.js";
import { U2SPacket } from "./U2SPacket.js";

const Enum2Class = {
    [PacketType.Client2Server]: C2SPacket,
    [PacketType.Server2Client]: S2CPacket,
    [PacketType.Server2Uploader]: S2UPacket,
    [PacketType.Uploader2Server]: U2SPacket,
    [PacketType.Server2Thumbnail]: S2TPacket,
    [PacketType.Thumbnail2Server]: T2SPacket,
    [PacketType.Generic]: GenericPacket
} as const;

const EnumArray = [
    PacketType.Client2Server,
    PacketType.Server2Client,
    PacketType.Uploader2Server,
    PacketType.Server2Uploader,
    PacketType.Thumbnail2Server,
    PacketType.Server2Thumbnail,
    PacketType.Generic
] as const;

export const PacketDefinitions = {
    enum2class: Enum2Class,
    enumArray: EnumArray
} as const;

export type PacketTypeMap = {
    [K in keyof typeof Enum2Class]: (typeof Enum2Class)[K]["prototype"];
};

export type PacketWithID<T extends Packet> = { new (data: any): T; ID: string };
