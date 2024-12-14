import type { Packet } from "./Packet.js";
import { safeDestr } from "destr";
import type { UnknownPacketStructure } from "../packets.js";
import { isRecord } from "../types.js";
import { patterns } from "../patterns.js";
import { C2SPacket } from "./C2SPacket.js";
import { S2CPacket } from "./S2CPacket.js";
import { S2UPacket } from "./S2UPacket.js";
import { U2SPacket } from "./U2SPacket.js";
import fs from "node:fs";
import path from "node:path";

export function getPacketClassById<T extends PacketType>(id: string, expectedType: T): Packet | null {
    if (!patterns.packetId.test(id)) return null;
    const [type, name] = id.split(":");

    // Allowing any client to create packets meant to be handled by another service is terrible!!!
    if (type !== expectedType) return null;

    const list = getPacketList(expectedType);
    const classVar = list.find(({ ID }) => ID === name);
    if (!classVar) return null;
    return new classVar();
}

export function parsePacket<T extends PacketType>(message: string | Buffer | ArrayBuffer | Buffer[], type: T): PacketTypeMap[T] | null {
    if (message instanceof Buffer || message instanceof ArrayBuffer) {
        message = message.toString();
    } else if (Array.isArray(message)) {
        message = Buffer.concat(message.map((x) => new Uint8Array(x))).toString();
    }

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

    const packet = getPacketClassById(data.id, type) as PacketTypeMap[T] | null;
    if (packet === null) return null;

    const isValidData = packet.setData(data.data);
    // TODO: optional rework for validation errors to be sent to the client
    if (!isValidData) return null;

    // If a packet is missing the "uuid" field, it just cannot be replied to!
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

export type PacketWithID<T extends Packet> = { new (): T; ID: string };

async function loadClassesForFolder<T extends PacketType>(folder: T) {
    /**
     * Needs to be defined in here to prevent initialization issues
     */
    const packetTypes = {
        [PacketType.Client2Server]: C2SPacket,
        [PacketType.Server2Client]: S2CPacket,
        [PacketType.Server2Uploader]: S2UPacket,
        [PacketType.Uploader2Server]: U2SPacket
    } as const;
    const folderPath = path.join(__dirname, folder);

    const list = new Array<PacketWithID<PacketTypeMap[T]>>();
    const expectedType = packetTypes[folder];

    if (!fs.existsSync(folderPath)) {
        console.warn(`Folder not found: ${folderPath}`);
        return list;
    }

    const files = fs.readdirSync(folderPath);

    for (const file of files) {
        const filePath = path.join(folderPath, file);
        const stat = fs.statSync(filePath);

        if (!stat.isFile() || !/\.(js|ts)$/.test(file)) continue;
        const className = path.basename(file, path.extname(file));

        const classVar = await importFileWithClass<typeof expectedType>(filePath, className);
        if (!classVar || Object.getPrototypeOf(classVar) !== expectedType) {
            console.warn(`${folder}/${className} not found or does not extend ${expectedType.name}`);
            continue;
        }

        // @ts-expect-error We check above whether this object is a child of the type we wish to read.
        list.push(classVar);
    }

    return list;
}

async function importFileWithClass<Class = Object>(path: string, className: string): Promise<Class | null> {
    try {
        const ref = await import(path);
        return ref[className] ?? null;
    } catch {
        return null;
    }
}

const packetTypeLists: Record<PacketType, PacketWithID<Packet>[]> = {
    [PacketType.Client2Server]: [],
    [PacketType.Server2Client]: [],
    [PacketType.Server2Uploader]: [],
    [PacketType.Uploader2Server]: []
};

function getPacketList<T extends PacketType>(type: T): PacketWithID<PacketTypeMap[T]>[] {
    return packetTypeLists[type];
}

async function loadPackets() {
    console.info(`[Packet Parser] Loading packets`);
    packetTypeLists[PacketType.Client2Server] = await loadClassesForFolder(PacketType.Client2Server);
    packetTypeLists[PacketType.Server2Client] = await loadClassesForFolder(PacketType.Server2Client);
    packetTypeLists[PacketType.Server2Uploader] = await loadClassesForFolder(PacketType.Server2Uploader);
    packetTypeLists[PacketType.Uploader2Server] = await loadClassesForFolder(PacketType.Uploader2Server);
    for (const type in packetTypeLists) {
        console.info(`[Packet Parser] ${type}:`, packetTypeLists[type as PacketType]);
    }
}

setTimeout(loadPackets, 1);
