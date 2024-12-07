import { Packet } from "./Packet";
import { PacketType } from "./parser";

export abstract class S2CPacket extends Packet {
    protected constructor(id: string, data?: Record<string, any>) {
        super(Packet.createPrefixedId(PacketType.Server2Client, id), data);
    }
}
