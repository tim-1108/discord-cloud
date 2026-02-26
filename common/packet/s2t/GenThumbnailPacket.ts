import { patterns } from "../../patterns.js";
import type { SchemaToType } from "../../validator.js";
import { S2TPacket } from "../S2TPacket.js";
import type { UUID } from "../../index.js";

const id = "gen-thumbnail";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    file_id: { type: "number", required: true, min: 0 },
    channel_id: { type: "string", required: true, pattern: patterns.snowflake },
    first_msg_id: { type: "string", required: true, pattern: patterns.snowflake },
    file_type: { type: "string", required: true },
    is_encrypted: { type: "boolean", required: true }
} as const;

export class GenThumbnailPacket extends S2TPacket {
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
