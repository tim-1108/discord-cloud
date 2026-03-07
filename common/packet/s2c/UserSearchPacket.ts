import type { SchemaToType } from "../../validator.js";
import { S2CPacket } from "../S2CPacket.js";
import type { UUID } from "../../index.js";

const id = "user-search";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    success: {
        type: "boolean",
        required: true
    },
    results: {
        type: "array",
        required: false,
        item_schema: {
            type: "record",
            required: true,
            items: {
                id: { type: "number", min: 0, required: true },
                name: { type: "string", min_length: 1, required: true }
            }
        }
    }
} as const;

export class UserSearchPacket extends S2CPacket {
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
