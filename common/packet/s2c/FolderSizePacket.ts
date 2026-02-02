import type { SchemaToType } from "../../validator.js";
import { S2CPacket } from "../S2CPacket.js";
import type { UUID } from "../../index.js";

const id = "folder-size";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    total_size: { type: "number", required: true, min: 0 },
    folder_id: { type: "number", required: true, min: 0, allow_null: true },
    // This is kept as a record only due to convience of this typing. On the client,
    // this is converted into an array of [string,number] objects for easier access.
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

    public constructor(data: DataType | UUID | null) {
        super(id, data);
    }
}
