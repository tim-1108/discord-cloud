import { type CloseEvent as ServersideCloseEvent, type MessageEvent as ServersideMessageEvent, WebSocket as ServersideWebSocket } from "ws";
import { Packet } from "./Packet.js";
import type { DataErrorFields, UUID } from "../index.js";
import { isServerside } from "../types.js";
import { logWarn } from "../logging.js";
import { createResolveFunction } from "../useless.js";

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
    resolve: (val: Packet | null) => void;
}

/**
 * This class may either use a socket from the "ws" package or
 * the DOM implementation of the `WebSocket` class. Some methods
 * and events differ from server to clients and thus should
 * be implemented with a check.
 */
type ServerOrClientSocket = WebSocket | ServersideWebSocket;
type CloseEventType<T extends ServerOrClientSocket> = T extends WebSocket ? CloseEvent : ServersideCloseEvent;
type MessageEventType<T extends ServerOrClientSocket> = T extends WebSocket ? MessageEvent : ServersideMessageEvent;

/**
 * An abstract class used for communicating over a socket with packets in the format of `Packet`.
 * This class can be applied both inside a browser using the `WebSocket` API of the DOM and inside
 * Node using the `ws` package.
 *
 * Send a packet using `sendPacket`. Any packet that extends the `Packet` class can be sent
 * and will be serialized into a JSON object when sent.
 *
 * Using the method `sendPacketAndReply`, the callee may optionally await a Promise that can
 * return a reply packet of, and only of, the supplied class. If the set or default timeout
 * is exceeded and nothing is received, that Promise will resolve with `null` instead of
 * an instance of `replyClass`.
 *
 * If the implementer of this class has received a packet over the network and may wish to
 * send a reply to it, call `replyToPacket` with the original received packet and the packet
 * to be answered with.
 *
 * Whenever incoming packets are handled inside the `handleSocketMessage` method, which every
 * subclass has to implement, make sure to call `resolveReplies`, to check if the packet that
 * has just been received might have been meant as a reply to something else. This then gets
 * handled and should eliminate all reasons to process this packet further (as a Promise at
 * another location will have been resolved with that incoming packet).
 *
 * It is important to call `initialize` to load all listeners for the socket
 * (optimally inside the constructor). This methods return value indicates success
 * in opening the socket connection.
 */
export abstract class PacketReceiver {
    protected socket: ServerOrClientSocket;

    protected constructor(socket: ServerOrClientSocket) {
        this.socket = socket;
        this.socket.addEventListener("message", (event: MessageEventType<typeof this.socket>) => this.handleSocketMessage(event));
        this.socket.addEventListener("close", (event: CloseEventType<typeof this.socket>) => this.handleSocketClose(event));
    }

    private replies = new Map<UUID, ResolveFunction>();

    public closeSocket(code?: number, reason?: string): void {
        this.socket.close(code, reason);
    }

    private static REPLY_TIMEOUT_MS = 10_000 as const;
    protected scheduleReply(id: UUID, timeout?: number) {
        const { promise, resolve } = createResolveFunction<Packet | null>();
        const timer = setTimeout(() => {
            resolve(null);
            this.replies.delete(id);
        }, timeout ?? PacketReceiver.REPLY_TIMEOUT_MS);

        const resolveFunc = (data: Packet) => {
            clearTimeout(timer);
            resolve(data);
            this.replies.delete(id);
        };

        this.replies.set(id, { resolve, callable: resolveFunc });

        return promise;
    }

    /**
     * Attempts to resolve one of the hanging replies this {@link PacketReceiver} subclass
     * might have by looking up the reply-UUID for this packet in its list.
     * @param packet
     * @protected
     * @returns Whether something was resolved by this packet
     */
    protected resolveReplies(packet: Packet): boolean {
        const uuid = packet.getReplyUUID();
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
     * @param timeout The ms after which the wait for a reply should time out (Default: {@link REPLY_TIMEOUT_MS})
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
        return new Promise((resolve) => {
            if (this.socket.readyState !== WebSocket.OPEN) {
                logWarn(this.constructor.name, "has tried to send a packet on a closed socket:", packet.toString());
                return resolve(new Error("Service socket is closed"));
            }

            if (isServerside()) {
                (this.socket as ServersideWebSocket).send(packet.serialize(), (err) => {
                    err ? resolve(err) : resolve(null);
                });
            } else {
                this.socket.send(packet.serialize());
                resolve(null);
            }
        });
    }

    /**
     * @deprecated use `sendPacketAndReply_new`
     */
    public async sendPacketAndReply<R extends Packet>(packet: Packet, replyClass: { new (): R }, timeoutMs?: number): Promise<R | null> {
        const uuid = packet.setRandomUUID();
        const reply = this.scheduleReply(uuid, timeoutMs);

        const sent = await this.sendPacket(packet);
        if (sent !== null) return null;
        const response = await reply;

        // Only allow packets of the EXACT type the function caller requested
        return response instanceof replyClass ? response : null;
    }

    public async sendPacketAndReply_new<R extends Packet>(
        packet: Packet,
        replyClass: { new (): R } | { new (): R }[],
        timeoutMs?: number
    ): Promise<DataErrorFields<R, string, "packet">> {
        const uuid = packet.setRandomUUID();
        const promise = this.scheduleReply(uuid, timeoutMs);

        if (this.socket.readyState !== this.socket.OPEN) {
            return { packet: null, error: "The socket is not open, state: " + this.socket.readyState };
        }

        const sent = await this.sendPacket(packet);
        if (sent !== null) return { packet: null, error: "Failed to send the packet" };
        const reply = await promise;

        if (reply === null) {
            return { packet: null, error: "Received no reply within the timeout" };
        }

        const ret = (flag: boolean) => (flag ? { packet: reply as R, error: null } : { packet: null, error: "Received a reply of an invalid type" });
        if (Array.isArray(replyClass)) {
            return ret(replyClass.some(($class) => reply instanceof $class));
        }

        return ret(reply instanceof replyClass);
    }

    protected abstract handleSocketClose(event: CloseEventType<typeof this.socket>): void;

    protected abstract handleSocketMessage(event: MessageEventType<typeof this.socket>): void;
}
