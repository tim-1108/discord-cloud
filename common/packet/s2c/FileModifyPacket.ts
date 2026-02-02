import type { SchemaToType } from "../../validator.js";
import { S2CPacket } from "../S2CPacket.js";
import { patterns } from "../../patterns.js";
import { ClientFileSchema } from "../../client.js";
import type { UUID } from "../../index.js";

const id = "file-modify";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    path: { type: "string", required: true, pattern: patterns.stringifiedPath },
    action: { type: "string", required: true, pattern: /^(add|delete|modify)$/ },
    handle: ClientFileSchema
} as const;

export class FileModifyPacket extends S2CPacket {
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
