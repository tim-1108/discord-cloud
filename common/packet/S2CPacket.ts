import { Packet } from "./Packet.js";
import { PacketType } from "./parser.js";

export abstract class S2CPacket extends Packet {
    protected constructor(id: string, data?: Record<string, any>) {
        super(Packet.createPrefixedId(PacketType.Server2Client, id), data);
    }
}
