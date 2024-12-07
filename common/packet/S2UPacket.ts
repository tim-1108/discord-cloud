import { Packet } from "./Packet";
import { PacketType } from "./parser";

export abstract class S2UPacket extends Packet {
    protected constructor(id: string, data?: Record<string, any>) {
        super(Packet.createPrefixedId(PacketType.Server2Uploader, id), data);
    }
}
