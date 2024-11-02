import type { PacketType } from "../utils/packets.ts";
import { type SchemaEntryConsumer, validateObjectBySchema } from "../utils/validator.ts";
import { isRecord } from "../utils/types.ts";

export abstract class Packet {
	protected data: Record<string, any> | null;
	private readonly id: string;

	protected constructor(id: string) {
		this.data = null;
		this.id = id;
	}

	/**
	 * Serializes a packet by creating a JSON structure and stringify-ing that.
	 */
	public serialize() {
		return JSON.stringify({ id: this.id, data: this.data });
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

	public readonly dataStructure: SchemaEntryConsumer | null = Packet.createDataStructure();

	/**
	 * Verifies the data inputted and validates it with
	 * the schema the individual packet class provides.
	 *
	 * Returns whether the data submitted is correct for the packet,
	 * indicating that the data has been stored.
	 */
	public setData(incoming: Record<string, any> | null): boolean {
		if (!this.dataStructure) console.warn("No data structure set for packet", this.constructor.name);
		if (!isRecord(incoming) || !this.dataStructure) return false;
		const validation = validateObjectBySchema(incoming, this.dataStructure);
		if (!validation.invalid) {
			this.data = incoming;
		}
		return !validation.invalid;
	}
}
