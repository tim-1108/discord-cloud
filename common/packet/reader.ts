import { logDebug, logWarn } from "../logging.js";
import type { Packet } from "./Packet.js";
import { type PacketTypeMap, type PacketWithID } from "./definitions.js";
import { parsePacket } from "./parser.js";
import fs from "node:fs";
import path from "node:path";
import { PacketDefinitions } from "./definitions.js";
import PacketType from "./PacketType.js";

async function loadClassesForFolder<T extends PacketType>(folder: T) {
    if (!import.meta.dirname) {
        console.warn("[Packet Parser] import.meta.dirname not defined");
        return [];
    }
    /**
     * Needs to be defined in here to prevent initialization issues
     */
    const packetTypes = PacketDefinitions.enum2class;
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
            logWarn(`${folder}/${className} not found or does not extend ${expectedType.name}`);
            continue;
        }

        // @ts-expect-error We check above whether this object is a child of the type we wish to read.
        list.push(classVar);
    }

    return list;
}

async function importFileWithClass<Class = Object>(path: string, className: string): Promise<Class | null> {
    const hasFileProtocol = /$file:/.test(path);
    path = hasFileProtocol ? path : "file://" + path;
    try {
        const ref = await import(path);
        return ref[className] ?? null;
    } catch (error) {
        console.log(error);
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

export async function loadPackets() {
    for (const key of PacketDefinitions.enumArray) {
        packetTypeLists[key] = await loadClassesForFolder(key);
    }
    //logDebug("Loaded packets", ...Object.values(packetTypeLists));
}
