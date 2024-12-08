import { type CloseEvent, type MessageEvent, WebSocket } from "ws";
import type { Packet } from "./Packet";
import type { UUID } from "../index";

interface ResolveFunction {
    /**
     * The thing to actually call when we received a reply
     * @param packet The reply packet
     */
    callable: (packet: Packet) => void;
    /**
     * A reference to the actual "resolve" function of the Promise.
     *
     * In some circumstances, the link between this and the actual Promise
     * seems to be severed.
     * Thus, calling this will never resolve the Promise.
     *
     * Maybe this is some strange quirk, and this implementation may not work either.
     */
    resolve: (data: unknown) => void;
}

export abstract class PacketReceiver {
    protected socket: WebSocket;

    protected constructor(socket: WebSocket) {
        this.socket = socket;
    }

    private replies = new Map<UUID, ResolveFunction>();

    private static REPLY_TIMEOUT = 10_000 as const;
    protected scheduleReply<T extends Packet>(id: UUID, timeout?: number): Promise<T | null> {
        const t = new Promise((resolve) => void 0);

        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                console.log(`[scheduleReply] Woops, the time ran out for ${id}`);
                this.replies.get(id)?.resolve(null);
                this.replies.delete(id);
            }, timeout ?? PacketReceiver.REPLY_TIMEOUT);

            const resolveFunc = (data: T) => {
                clearTimeout(timer);
                console.log(`[scheduleReply] Resolved ${id} with`, data);
                this.replies.get(id)?.resolve(data);
                this.replies.delete(id);
            };

            // @ts-expect-error
            this.replies.set(id, { resolve, callable: resolveFunc });
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
        console.log(`[resolveReplies] reply map:`, this.replies, uuid);
        if (uuid === null || !this.replies.size) return false;
        const func = this.replies.get(uuid);
        if (!func) return false;
        func.callable(packet);
        return true;
    }

    /**
     * Replies to a packet previously sent on this socket.
     *
     * This acts as a wrapper function to use {@link Packet.setReplyUUID} on the target packet.
     *
     * If the replyPacketClass is specified, a reply to this packet can also be awaited.
     * @param originator The original packet to reply to
     * @param myPacket The packet to send
     * @param replyPacketClass The class a possible reply is allowed to be of
     * @param timeout The ms after which the wait for a reply should time out (Default: {@link REPLY_TIMEOUT})
     */
    public replyToPacket<R extends Packet>(
        originator: Packet,
        myPacket: Packet,
        replyPacketClass?: { new (): R },
        timeout?: number
    ): typeof replyPacketClass extends undefined ? Promise<Error | null> : Promise<R | null> {
        const originatorUUID = originator.getUUID();
        // If the original packet has no "uuid" field set, we will just not be able to reply to it.
        // This function will not fail, only the reply-portion will silently fail
        if (originatorUUID) myPacket.setReplyUUID(originatorUUID);

        if (replyPacketClass) {
            return this.sendPacketAndReply(myPacket, replyPacketClass, timeout);
        }

        // @ts-expect-error does not comply with conditional type
        return this.sendPacket(myPacket);
    }

    /**
     * Sends a Packet type through the socket.
     *
     * Resolves to a promise once the data has been sent.
     *
     * If an error should occur while sending the packet,
     * the promise is resolved with the error object.
     */
    public sendPacket(packet: Packet): Promise<Error | null> {
        console.info(`[${this.constructor.name}] Sending packet ${packet.id} with data`, JSON.parse(packet.serialize()));
        return new Promise((resolve, reject) => {
            if (this.socket.readyState !== WebSocket.OPEN) {
                console.warn("A service which has a closed socket has tried to send a message", this.constructor.name);
                return resolve(new Error("Service socket is closed"));
            }

            this.socket.send(packet.serialize(), (err) => {
                err ? resolve(err) : resolve(null);
            });
        });
    }

    public async sendPacketAndReply<R extends Packet>(packet: Packet, replyClass: { new (): R }, timeout?: number): Promise<R | null> {
        const uuid = packet.setRandomUUID();
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
