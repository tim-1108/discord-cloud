import type { UUID } from "./index.js";

export interface PacketStructure extends UnknownPacketStructure {
    id: string;
    data: Record<string, any>;
    uuid: UUID;
    reply_uuid: UUID;
}
export interface UnknownPacketStructure {
    id: any;
    data: any;
    uuid: any;
    reply_uuid: any;
}
