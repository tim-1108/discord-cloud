import { UploadQueueAddPacket } from "../packet/c2s/UploadQueueAddPacket.ts";
import { C2SPacket } from "../packet/C2SPacket.ts";
import type { Packet } from "../packet/Packet.ts";

import { safeDestr } from "destr";
import type { UnknownPacketStructure } from "../../common/packets";
import { isRecord } from "./types.ts";
import { patterns } from "./patterns.ts";
import type { S2CPacket } from "../packet/S2CPacket.ts";
import type { S2UPacket } from "../packet/S2UPacket.ts";
import type { U2SPacket } from "../packet/U2SPacket.ts";
import { UploadStartPacket } from "../packet/s2u/UploadStartPacket.ts";
import { UploadStartConfirmPacket } from "../packet/u2s/UploadStartConfirmPacket.ts";

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
		case "s2u":
			return identifyUploaderboundServerPacket(name);
		case "u2s":
			return identifyServerboundUploaderPacket(name);
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
function identifyUploaderboundServerPacket(id: string): S2UPacket | null {
	switch (id) {
		case "upload-start":
			return new UploadStartPacket();
		default:
			return null;
	}
}
function identifyServerboundUploaderPacket(id: string): U2SPacket | null {
	switch (id) {
		case "upload-start-confirm":
			return new UploadStartConfirmPacket();
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

	if (patterns.uuid.test(data.uuid)) packet.setUUID(data.uuid);
	if (patterns.uuid.test(data.reply_uuid)) packet.setReplyUUID(data.reply_uuid);

	return packet;
}

export enum PacketType {
	Client2Server = "c2s",
	Server2Client = "s2c",
	Server2Uploader = "s2u",
	Uploader2Server = "u2s"
}

type PacketTypeMap = {
	[PacketType.Client2Server]: C2SPacket;
	[PacketType.Server2Client]: S2CPacket;
	[PacketType.Server2Uploader]: S2UPacket;
	[PacketType.Uploader2Server]: U2SPacket;
};
