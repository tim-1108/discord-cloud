import { Packet } from "./Packet.ts";
import { PacketType } from "../utils/packets.ts";

export abstract class C2SPacket extends Packet {
	protected constructor(id: string) {
		super(Packet.createPrefixedId(PacketType.Client2Server, id));
	}
}
