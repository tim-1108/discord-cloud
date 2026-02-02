import type { UUID } from "../index.js";
import { Packet } from "./Packet.js";
import PacketType from "./PacketType.js";

export abstract class GenericPacket extends Packet {
    protected constructor(id: string, data: Record<string, any> | UUID | null) {
        super(Packet.createPrefixedId(PacketType.Generic, id), data);
    }
}
