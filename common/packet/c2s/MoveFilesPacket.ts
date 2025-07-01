import { C2SPacket } from "../C2SPacket.js";
import type { SchemaToType } from "../../validator.js";

const id = "move-files";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    /**
     * If not specified, root folder is assumed
     */
    source_id: { type: "number", required: false, min: 0 },
    /**
     * If not specified, root folder is assumed
     */
    target_id: { type: "number", required: false, min: 0 },
    files: { type: "array", required: true, item_type: "string", min_length: 1 }
} as const;

export class MoveFilesPacket extends C2SPacket {
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
