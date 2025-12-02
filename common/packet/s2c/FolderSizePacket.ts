import type { SchemaToType } from "../../validator.js";
import { S2CPacket } from "../S2CPacket.js";

const id = "folder-size";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    total_size: { type: "number", required: true, min: 0 },
    folder_id: { type: "number", required: true, min: 0, allow_null: true },
    types: { type: "generic_record", required: true, value_type: "number" }
} as const;

export class FolderSizePacket extends S2CPacket {
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
