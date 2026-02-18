import { type SchemaEntryConsumer, validateObjectBySchema } from "../validator.js";
import { isRecord, isUUID } from "../types.js";
import type { UUID } from "../index.js";
import PacketType from "./PacketType.js";

export abstract class Packet {
    protected data: Record<string, any> | null;
    public readonly id: string;
    /**
     * Used to listen for a reply of for this packet.
     *
     * A socket partner, if replying to this packet, should send the
     * corresponding packet UUID with it.
     *
     * If it is not specified, some packets may be ignored due to
     * their dependence on this attribute.
     * (i.e., accept and deny packets)
     */
    private uuid: UUID | null;
    private replyTo: UUID | null;

    private readonly isReceivedPacket: boolean;
    private isDebugPacket: boolean;
    public markAsDebugPacket(): void {
        this.isDebugPacket = true;
    }

    /**
     * Initializes the `Packet`. The `id` field describes a namespaced packet
     * id like `c2s:test`, with the namespace specified by each direct inheritor
     * of this class. The `data` field may either describe the packet data with
     * which this packet should be initialized, or the packet's UUID.
     *
     * When creating a packet to be **sent** over the socket, you need to specify
     * the packet's data within the constructor, for instance `new TestPacket({ foo: "bar" })`.
     * This will validate the packet data and throw a `SyntaxError` if the input is
     * invalid. TypeScript detections also work for this.
     *
     * The UUID is only specified instead of the data when instantiating packets
     * **received** over the socket. The actual packet's data is set then via
     * `Packet.prototype.setData`, which returns `false` if the data is invalid,
     * thus voiding that packet.
     *
     * If the UUID is provided, the internal flag `isReceivedPacket` is set to `true`,
     * causing an error to be thrown when the packet is attempted to be sent someplace.
     * For ease of testing, a UUID is not required. If the other side of the socket
     * does not specify one, input `null` into this constructor. This will mean that
     * replies to this packet will go through, but not addressed via the `reply_to` field.
     */
    protected constructor(id: string, data: Record<string, any> | UUID | null) {
        // JS does not have multiple possible constructors for one class
        // (classes are only syntatic sugar, .constructor can only exist once)
        // ... so, one argument for both types has to do it.
        const hasSetUUID = (typeof data === "string" && isUUID(data)) || data === null;
        this.data = null;
        this.id = id;
        this.uuid = hasSetUUID ? data : null;
        this.replyTo = null;
        this.isDebugPacket = false;

        this.isReceivedPacket = hasSetUUID;
        if (!hasSetUUID) {
            const success = this.setData(data);
            if (!success) {
                throw new SyntaxError("Invalid data provided in constructor for " + this.constructor.name + ": " + JSON.stringify(data));
            }
        }
    }

    /**
     * Set the UUID of what this packet is replying to
     * @param uuid The UUID of the originator packet
     */
    public setReplyUUID(uuid: UUID) {
        this.replyTo = uuid;
    }

    /**
     * What is this packet a reply to (or at least what the sender claims it is)
     */
    public getReplyUUID() {
        return this.replyTo;
    }

    /**
     * Only sets the UUID of this packet to something random if it is not yet set.
     * Returns that new UUID or the pre-existing UUID.
     */
    public setRandomOrGetUUID(): UUID {
        if (this.uuid) return this.uuid;
        this.uuid = crypto.randomUUID();
        return this.uuid;
    }

    /**
     * Serializes a packet by creating a JSON structure and stringify-ing that.
     */
    public serialize() {
        if (this.isReceivedPacket && !this.isDebugPacket) throw new SyntaxError("Cannot send a received packet");
        return JSON.stringify({
            id: this.id,
            data: this.data ?? {},
            // On sent packets the UUID is not set by default and thus only required to be set here.
            // The other side should be able to reply to this message.
            uuid: this.setRandomOrGetUUID(),
            reply_uuid: this.replyTo ?? undefined
        });
    }

    public static createPrefixedId(type: PacketType, id: string) {
        return `${type}:${id}`;
    }

    // These methods are not used due to them not allowing type assertion for the data fields.

    public static createDataStructure(data: SchemaEntryConsumer): SchemaEntryConsumer;
    public static createDataStructure(data?: undefined): null;

    public static createDataStructure(data?: SchemaEntryConsumer) {
        return data ?? null;
    }

    public getData() {
        return this.data;
    }

    public getUUID() {
        return this.uuid;
    }

    public abstract getDataStructure(): SchemaEntryConsumer;

    /**
     * Verifies the data inputted and validates it with
     * the schema the individual packet class provides.
     *
     * Returns whether the data submitted is correct for the packet,
     * indicating that the data has been stored.
     */
    public setData(incoming: Record<string, any> | null): boolean {
        const flag = this.isValidData(incoming);
        if (flag) {
            this.data = incoming;
        }
        return flag;
    }

    public isValidData(incoming: Record<string, any> | null) {
        const structure = this.getDataStructure();
        if (!structure) {
            console.warn("No data structure set for packet", this.constructor.name);
            return false;
        }
        if (!isRecord(incoming)) return false;
        const validation = validateObjectBySchema(incoming, structure);
        return !validation.invalid;
    }

    public toString() {
        return `[${this.constructor.name}]: ${JSON.stringify(this.getData())}`;
    }
}
