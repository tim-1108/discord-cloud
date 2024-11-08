import type { PacketType } from "../utils/packets.ts";
import { type SchemaEntryConsumer, validateObjectBySchema } from "../utils/validator.ts";
import { isRecord } from "../utils/types.ts";
import type { UUID } from "../../common";

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

    protected constructor(id: string, data?: Record<string, any>) {
        this.data = null;
        this.id = id;
        this.uuid = null;
        this.replyTo = null;

        // The data parameter should only be provided when creating a packet,
        // not when receiving it from an outside source. For that, use the
        // dynamic packet creation.

        // BE CAREFUL WITH THIS!!!
        this.isReceivedPacket = typeof data === "undefined";
        if (data) {
            const result = this.setData(data);
            if (!result) throw new SyntaxError("Invalid data provided in constructor for " + this.constructor.name);
        }
    }

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
     * Serializes a packet by creating a JSON structure and stringify-ing that.
     */
    public serialize() {
        if (this.isReceivedPacket) throw new SyntaxError("Cannot send a received packet");
        // On sent packets the UUID is not set by default and thus only required to be set here.
        // The other side should be able to reply to this message.
        if (!this.uuid) this.uuid = crypto.randomUUID();
        return JSON.stringify({ id: this.id, data: this.data ?? {}, uuid: this.uuid, reply_uuid: this.replyTo ?? undefined });
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
        const structure = this.getDataStructure();
        if (!structure) {
            console.warn("No data structure set for packet", this.constructor.name);
            return false;
        }
        if (!isRecord(incoming)) return false;
        const validation = validateObjectBySchema(incoming, structure);
        if (!validation.invalid) {
            this.data = incoming;
        }
        return !validation.invalid;
    }

    public setUUID(uuid: UUID) {
        this.uuid = uuid;
    }
}
