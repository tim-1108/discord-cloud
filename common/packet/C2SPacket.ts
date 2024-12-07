import { Packet } from "./Packet";
import { PacketType } from "./parser";

export abstract class C2SPacket extends Packet {
    protected constructor(id: string, data?: Record<string, any>) {
        super(Packet.createPrefixedId(PacketType.Client2Server, id), data);
    }
}
