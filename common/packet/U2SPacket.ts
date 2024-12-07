import { Packet } from "./Packet";
import { PacketType } from "./parser";

export abstract class U2SPacket extends Packet {
    protected constructor(id: string, data?: Record<string, any>) {
        super(Packet.createPrefixedId(PacketType.Uploader2Server, id), data);
    }
}
