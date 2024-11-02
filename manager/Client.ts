import { type CloseEvent, type MessageEvent, WebSocket } from "ws";
import type { UUID } from "../common";
import { PacketType, parsePacket } from "./utils/packets.ts";
import { UploadQueueAddPacket } from "./packet/c2s/UploadQueueAddPacket.ts";

export class Client {
	private ws: WebSocket;
	private readonly uuid: UUID;

	public getUUID() {
		return this.uuid;
	}

	public constructor(ws: WebSocket) {
		this.ws = ws;
		this.uuid = crypto.randomUUID();
		this.initialize();
	}

	private initialize() {
		if (this.ws.readyState !== WebSocket.OPEN) {
			return;
		}

		this.ws.onmessage = this.handleSocketMessage;
		this.ws.onclose = this.handleSocketClose;

		Client.clients.add(this);
	}

	private handleSocketClose(event: CloseEvent) {
		Client.clients.delete(this);
	}

	private handleSocketMessage(event: MessageEvent) {
		const packet = parsePacket(event.data, PacketType.Client2Server);
		if (packet === null) return;

		if (packet instanceof UploadQueueAddPacket) {
			const data = packet.getData();
		}
	}

	private static clients = new Set<Client>();
}
