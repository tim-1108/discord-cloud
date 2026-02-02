import type { ClientFileHandle, ClientFolderHandle } from "../../client.js";
import { patterns } from "../../patterns.js";
import { createArraySchemaEntry, type SchemaToType } from "../../validator.js";
import { S2CPacket } from "../S2CPacket.js";
import type { UUID } from "../../index.js";

const id = "list";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    // Technically not needed since this packet is replying to another one.
    // However, if the client does not await a reply and only parses packets as-is,
    // this might act as a working fallback.
    path: { type: "string", required: true, pattern: patterns.stringifiedPath },
    files: createArraySchemaEntry<ClientFileHandle, any, true>({ required: true, validator_function: validateFiles }),
    folders: createArraySchemaEntry<ClientFolderHandle, any, true>({ required: true, validator_function: validateFolders }),
    success: { type: "boolean", required: true }
} as const;

function validateFiles(list: any[]): boolean {
    if (!Array.isArray(list)) return false;
    return list.every(
        (file) => file && patterns.fileName.test(file.name) && typeof file.type === "string" && Number.isSafeInteger(file.size) && file.size >= 0
    );
}
function validateFolders(list: any[]): boolean {
    if (!Array.isArray(list)) return false;
    return list.every((folder) => folder && patterns.fileName.test(folder.name) && Number.isSafeInteger(folder.id));
}

export class ListPacket extends S2CPacket {
    declare protected data: DataType;
    public static readonly ID = id;

    public getDataStructure() {
        return dataStructure;
    }

    public getData() {
        return this.data;
    }

    public constructor(data: DataType | UUID | null) {
        super(id, data);
    }
}
