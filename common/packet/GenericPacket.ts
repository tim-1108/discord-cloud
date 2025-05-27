import { Packet } from "./Packet.js";
import PacketType from "./PacketType.js";

export abstract class GenericPacket extends Packet {
    protected constructor(id: string, data?: Record<string, any>) {
        super(Packet.createPrefixedId(PacketType.Generic, id), data);
    }
}
