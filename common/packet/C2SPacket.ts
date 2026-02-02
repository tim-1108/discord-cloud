import type { UUID } from "../index.js";
import { Packet } from "./Packet.js";
import PacketType from "./PacketType.js";

export abstract class C2SPacket extends Packet {
    protected constructor(id: string, data: Record<string, any> | UUID | null) {
        super(Packet.createPrefixedId(PacketType.Client2Server, id), data);
    }
}
