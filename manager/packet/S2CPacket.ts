import { Packet } from "./Packet.ts";
import { PacketType } from "../utils/packets.ts";

export abstract class S2CPacket extends Packet {
    protected constructor(id: string, data?: Record<string, any>) {
        super(Packet.createPrefixedId(PacketType.Server2Client, id), data);
    }
}
