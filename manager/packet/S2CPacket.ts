import { Packet } from "./Packet.ts";
import { PacketType } from "../utils/packets.ts";

export abstract class S2CPacket extends Packet {
	protected constructor(id: string) {
		super(Packet.createPrefixedId(PacketType.Server2Client, id));
	}
}
