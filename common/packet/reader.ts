import { logDebug } from "../logging.js";
import { C2SPacket } from "./C2SPacket.js";
import type { Packet } from "./Packet.js";
import { PacketType, type PacketTypeMap, type PacketWithID } from "./parser.js";
import { S2CPacket } from "./S2CPacket.js";
import { S2UPacket } from "./S2UPacket.js";
import { U2SPacket } from "./U2SPacket.js";
import { parsePacket } from "./parser.js";
import fs from "node:fs";
import path from "node:path";
import { S2TPacket } from "./S2TPacket.js";
import { T2SPacket } from "./T2SPacket.js";

async function loadClassesForFolder<T extends PacketType>(folder: T) {
    if (!import.meta.dirname) {
        console.warn("[Packet Parser] import.meta.dirname not defined");
        return [];
    }
    /**
     * Needs to be defined in here to prevent initialization issues
     */
    const packetTypes = {
        [PacketType.Client2Server]: C2SPacket,
        [PacketType.Server2Client]: S2CPacket,
        [PacketType.Server2Uploader]: S2UPacket,
        [PacketType.Uploader2Server]: U2SPacket,
        [PacketType.Server2Thumbnail]: S2TPacket,
        [PacketType.Thumbnail2Server]: T2SPacket
    } as const;
    const folderPath = path.join(import.meta.dirname, folder);

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

// Because this file is imported by parser.js, and this file here
// imports PacketType from parser.js, it will not be available at the
// point where this record is created. Thus, we have to leave out these
// fields (that does not create any problems in itself - only TS compiler errors)
// (everything is filled in inside loadPackets)
// @ts-expect-error
const packetTypeLists: Record<PacketType, PacketWithID<Packet>[]> = {};

/**
 * Used as an argument for {@link parsePacket}.
 *
 * Returns an array filled with packets corresponding to the requested type (extending Packet).
 *
 * This function/this file (reader.ts) should only be used in server-side systems,
 * as this requires reading files in subfolders automatically. This is not an option
 * in a client environment.
 * @param type The type of packets to return
 * @returns A list of packets registered under the given {@link type}
 */
export function getServersidePacketList<T extends PacketType>(type: T): PacketWithID<PacketTypeMap[T]>[] {
    return packetTypeLists[type];
}

async function loadPackets() {
    packetTypeLists[PacketType.Client2Server] = await loadClassesForFolder(PacketType.Client2Server);
    packetTypeLists[PacketType.Server2Client] = await loadClassesForFolder(PacketType.Server2Client);
    packetTypeLists[PacketType.Server2Uploader] = await loadClassesForFolder(PacketType.Server2Uploader);
    packetTypeLists[PacketType.Uploader2Server] = await loadClassesForFolder(PacketType.Uploader2Server);
    packetTypeLists[PacketType.Server2Thumbnail] = await loadClassesForFolder(PacketType.Server2Thumbnail);
    packetTypeLists[PacketType.Thumbnail2Server] = await loadClassesForFolder(PacketType.Thumbnail2Server);
    logDebug("Loaded packets packets", ...Object.values(packetTypeLists));
}

setTimeout(loadPackets, 1);
