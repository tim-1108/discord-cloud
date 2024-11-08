import { type CloseEvent, type MessageEvent, WebSocket } from "ws";
import type { Packet } from "./packet/Packet.ts";
import type { UUID } from "../common";

export abstract class PacketReceiver {
    protected socket: WebSocket;

    protected constructor(socket: WebSocket) {
        this.socket = socket;
    }

    private replies = new Map<UUID, (data: Packet) => void>();

    private static REPLY_TIMEOUT = 10_000;
    protected scheduleReply<T extends Packet>(id: UUID, timeout?: number): Promise<T | null> {
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                this.replies.delete(id);
                resolve(null);
            }, timeout ?? PacketReceiver.REPLY_TIMEOUT);

            const resolveFunc = (data: T) => {
                this.replies.delete(id);
                clearTimeout(timer);
                resolve(data);
            };

            // @ts-ignore
            this.replies.set(id, resolveFunc);
        });
    }

    /**
     * Attempts to resolve one of the hanging replies this {@link PacketReceiver} subclass
     * might have by looking up the reply-UUID for this packet in its list.
     * @param packet
     * @protected
     */
    protected resolveReplies(packet: Packet) {
        const uuid = packet.getReplyUUID();
        if (uuid === null || !this.replies.size) return false;
        const func = this.replies.get(uuid);
        if (!func) return false;
        func(packet);
        return true;
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
            if (this.socket.readyState !== WebSocket.OPEN) {
                console.warn("A service which has a closed socket has tried to send a message", this.constructor.name);
                return reject(new Error("Service socket is closed"));
            }

            this.socket.send(packet.serialize(), (err) => {
                err ? reject(err) : resolve(null);
            });
        });
    }

    protected async sendPacketAndReply<R extends Packet>(packet: Packet, replyClass: { new (): R }, timeout?: number): Promise<R | null> {
        if (!packet.getUUID()) packet.setUUID(crypto.randomUUID());
        const uuid = packet.getUUID()!;
        const reply = this.scheduleReply<R>(uuid, timeout);

        const sent = await this.sendPacket(packet);
        if (sent !== null) return null;
        const response = await reply;

        // Only allow packets of the EXACT type the function caller requested
        return response instanceof replyClass ? response : null;
    }

    protected initialize() {
        if (this.socket.readyState !== WebSocket.OPEN) {
            return false;
        }

        this.socket.addEventListener("message", (event) => this.handleSocketMessage(event));
        this.socket.addEventListener("close", (event) => this.handleSocketClose(event));

        return true;
    }

    protected abstract handleSocketClose(event: CloseEvent): void;

    protected abstract handleSocketMessage(event: MessageEvent): void;
}
