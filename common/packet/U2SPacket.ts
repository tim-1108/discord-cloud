import { Packet } from "./Packet.js";
import { PacketType } from "./parser.js";

export abstract class U2SPacket extends Packet {
    protected constructor(id: string, data?: Record<string, any>) {
        super(Packet.createPrefixedId(PacketType.Uploader2Server, id), data);
    }
}
