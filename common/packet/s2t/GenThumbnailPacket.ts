import { patterns } from "../../patterns.js";
import type { SchemaToType } from "../../validator.js";
import { S2TPacket } from "../S2TPacket.js";

const id = "gen-thumbnail";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    id: { type: "number", required: true, min: 0 },
    channel: { type: "string", required: true, pattern: patterns.snowflake },
    // A list of snowflakes, we will fetch the first message individually later on
    messages: { type: "array", required: true, item_type: "string", validator_function: validateMessageIds },
    type: { type: "string", required: true }
} as const;

function validateMessageIds(obj: any): boolean {
    if (!Array.isArray(obj) || !obj.length) return false;
    return obj.every((value) => typeof value === "string" && patterns.snowflake.test(value));
}

export class GenThumbnailPacket extends S2TPacket {
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
