import { Packet } from "./Packet.ts";
import { PacketType } from "./parser.ts";

export abstract class C2SPacket extends Packet {
    protected constructor(id: string, data?: Record<string, any>) {
        super(Packet.createPrefixedId(PacketType.Client2Server, id), data);
    }
}
