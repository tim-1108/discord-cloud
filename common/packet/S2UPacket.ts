import type { UUID } from "../index.js";
import { Packet } from "./Packet.js";
import PacketType from "./PacketType.js";

export abstract class S2UPacket extends Packet {
    protected constructor(id: string, data: Record<string, any> | UUID | null) {
        super(Packet.createPrefixedId(PacketType.Server2Uploader, id), data);
    }
}
