import type { SchemaToType } from "../../validator.js";
import { GenericPacket } from "../GenericPacket.js";
import type { UUID } from "../../index.js";

const id = "boolean";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    success: { type: "boolean", required: true },
    message: { type: "string", required: false }
} as const;

export class GenericBooleanPacket extends GenericPacket {
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
