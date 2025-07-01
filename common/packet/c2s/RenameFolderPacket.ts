import { C2SPacket } from "../C2SPacket.js";
import { patterns } from "../../patterns.js";
import type { SchemaToType } from "../../validator.js";

const id = "rename-folder";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    path: { type: "string", required: true, pattern: patterns.stringifiedPath },
    target_name: { type: "string", required: true, pattern: patterns.fileName }
} as const;

export class RenameFolderPacket extends C2SPacket {
    declare protected data: DataType;
    public static readonly ID = id;

    public getDataStructure() {
        return dataStructure;
    }

    public getData() {
        return this.data;
    }

    public constructor(data?: DataType) {
        super(id, data);
    }
}
