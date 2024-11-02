import type { ServiceConfig } from "./list.ts";
import type { Packet } from "../packet/Packet.ts";

export abstract class Service {
	/**
	 * Represents the URL of the service.
	 *
	 * Should not contain any protocols (just (sub-)domains)
	 * @private
	 * @readonly
	 */
	private readonly config: ServiceConfig;
	/**
	 * Whether the service is currently processing
	 * user data. If so, it cannot be chosen to receive
	 * another until it notifies this manager in a finish packet.
	 * @private
	 */
	private busy: boolean = false;

	protected constructor(config: ServiceConfig) {
		this.config = config;
	}

	public isBusy() {
		return this.busy;
	}

	/**
	 * Sends a Packet type through the socket.
	 *
	 * Resolves to a promise once the data has been sent.
	 *
	 * If an error should occur while sending the packet,
	 * the promise is rejected.
	 */
	protected sendPacket(packet: Packet): Promise<Error | null> {
		return new Promise((resolve, reject) => {
			const { socket } = this.config;
			if (socket.readyState !== WebSocket.OPEN) {
				console.warn("A service which has a closed socket has tried to send a message", this.constructor.name);
				return reject(new Error("Service socket is closed"));
			}

			socket.send(packet.serialize(), (err) => {
				err ? reject(err) : resolve(null);
			});
		});
	}
}
