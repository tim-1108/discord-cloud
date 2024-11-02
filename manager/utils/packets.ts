import { UploadQueueAddPacket } from "../packet/c2s/UploadQueueAddPacket.ts";
import { C2SPacket } from "../packet/C2SPacket.ts";
import type { Packet } from "../packet/Packet.ts";

import { safeDestr } from "destr";
import type { UnknownPacketStructure } from "../common/packets";
import type { S2CPacket } from "../packet/S2CPacket.ts";
import { isRecord } from "./types.ts";

export function getPacketClassById(id: string, expectedType: PacketType): Packet | null {
	if (!id.includes(":")) return null;
	const [type, name] = id.split(":");

	// Allowing any client to create packets meant to be handled by another service is terrible!!!
	if (type !== expectedType) return null;

	switch (type) {
		case "c2s":
			return identifyServerboundClientPacket(name);
		case "s2c":
			return null;
		default:
			return null;
	}
}

function identifyServerboundClientPacket(id: string): C2SPacket | null {
	switch (id) {
		case "upload-queue-add":
			return new UploadQueueAddPacket();
		default:
			return null;
	}
}

export function parsePacket<T extends PacketType>(message: string | Buffer | ArrayBuffer | Buffer[], type: T): PacketTypeMap[T] | null {
	if (message instanceof Buffer || message instanceof ArrayBuffer) {
		message = message.toString();
	} else if (Array.isArray(message)) {
		message = Buffer.concat(message.map((x) => new Uint8Array(x))).toString();
	}

	// Is a INSECURE check to make sure only pseudo-Records are sent
	// (validated properly later on)
	if (!/{.*}/s.test(message)) return null;

	let data: UnknownPacketStructure | null = null;
	try {
		data = safeDestr<UnknownPacketStructure>(message, { strict: true });
	} catch {
		return null;
	}

	if (typeof data.id !== "string" || !isRecord(data.data)) {
		return null;
	}

	const packet = getPacketClassById(data.id, type) as PacketTypeMap[T] | null;
	if (packet === null) return null;

	const isValidData = packet.setData(data.data);
	// TODO: optional rework for validation errors to be sent to the client
	if (!isValidData) return null;
	return packet;
}

export enum PacketType {
	Client2Server = "c2s",
	Server2Client = "s2c"
}

type PacketTypeMap = {
	[PacketType.Client2Server]: C2SPacket;
	[PacketType.Server2Client]: S2CPacket;
};
