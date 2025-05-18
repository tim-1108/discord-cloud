import { Packet } from "./Packet.js";
import { PacketType } from "./definitions.js";

export abstract class T2SPacket extends Packet {
    protected constructor(id: string, data?: Record<string, any>) {
        super(Packet.createPrefixedId(PacketType.Thumbnail2Server, id), data);
    }
}
