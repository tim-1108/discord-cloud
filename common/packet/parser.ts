import type { Packet } from "./Packet.js";
import { safeDestr } from "destr";
import type { UnknownPacketStructure } from "../packets.js";
import { isRecord } from "../types.js";
import { patterns } from "../patterns.js";
import { type PacketTypeMap, type PacketWithID } from "./definitions.js";
import PacketType from "./PacketType.js";

type PacketProvider<T extends PacketType> = (type: T) => PacketWithID<PacketTypeMap[T]>[];

/**
 * Instantiates a Packet subclass with a given id with a type (c2s, s2c) prefix.
 *
 * Only instantiates that class if the type matches the {@link expectedType} allowed for the callee,
 * as one service should not be able to send packets meant to be coming from another.
 *
 * The {@link packetProvider} should use {@link getServersidePacketList} from reader.js, possible to use in server-side
 * circumstances. However, a client-side application cannot use this provider (never should call it!),
 * and thus has to provide their own list of packets.
 * @param id The raw id sent over the socket
 * @param expectedType The type we expect this packet to be of
 * @param packetProvider A provider to get a packet list from
 * @returns The instantiated packet, or `null`, if the passed id did not meet the requirements
 */
function getPacketClassById<T extends PacketType>(id: string, expectedType: T, packetProvider: PacketProvider<T>): Packet | null {
    if (!patterns.packetId.test(id)) return null;
    const [type, name] = id.split(":");

    // Allowing any client to create packets meant to be handled by another service is terrible!!!
    if (type !== expectedType) return null;

    const list = packetProvider(expectedType);
    const classVar = list.find(({ ID }) => ID === name);
    if (!classVar) return null;
    return new classVar();
}

/**
 * Parses a raw message received by a socket into a `Packet` instance meeting the required
 * subtype of `PacketType`. If not, or in an invalid state, `null` is returned. The packet's
 * data structure is also validated upon creation, and `null` is returned when the structure
 * is invalid.
 * @param message The raw data received over the socket. Is allowed to be everything received from a socket
 * @param type The `PacketType` this function should allow to parse, `Generic` is always included
 * @param packetProvider A function that resolves a `PacketType` to an array of `Packet` subclasses.
 *                       On the server, use `getServersidePacketList` from `reader.ts`.
 * @returns
 */
export function parsePacket<T extends PacketType>(
    message: string | Buffer | ArrayBuffer | Buffer[],
    type: T,
    packetProvider: PacketProvider<T | PacketType.Generic>
): PacketTypeMap[T] | null {
    if (Array.isArray(message)) {
        message = Buffer.concat(message.map((x) => new Uint8Array(x))).toString();
    }

    message = message.toString();

    // Is an INSECURE check to make sure only pseudo-Records are sent
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

    // If no packet of this type (like c2s) was found, we default to parsing a generic packet.
    // This still means that no packets from other channels can get onto this channel,
    // only that everyone can used the shared generic packets to communicate.
    const packet = getPacketClassById(data.id, type, packetProvider) ?? getPacketClassById(data.id, PacketType.Generic, packetProvider);
    if (packet === null) return null;

    const isValidData = packet.setData(data.data);
    // TODO: optional rework for validation errors to be sent to the client
    if (!isValidData) return null;

    // If a packet is missing the "uuid" field, it just cannot be replied to!
    if (patterns.uuid.test(data.uuid)) packet.setUUID(data.uuid);
    if (patterns.uuid.test(data.reply_uuid)) packet.setReplyUUID(data.reply_uuid);

    return packet;
}
