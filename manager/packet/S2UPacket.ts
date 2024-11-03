import { Packet } from "./Packet.ts";
import { PacketType } from "../utils/packets.ts";

export abstract class S2UPacket extends Packet {
	protected constructor(id: string, data?: Record<string, any>) {
		super(Packet.createPrefixedId(PacketType.Server2Uploader, id), data);
	}
}
