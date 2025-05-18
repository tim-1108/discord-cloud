import { Packet } from "./Packet.js";
import { PacketType } from "./definitions.js";

export abstract class S2UPacket extends Packet {
    protected constructor(id: string, data?: Record<string, any>) {
        super(Packet.createPrefixedId(PacketType.Server2Uploader, id), data);
    }
}
