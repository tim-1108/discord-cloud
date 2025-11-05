import type { SchemaToType } from "../../validator.js";
import { GenericPacket } from "../GenericPacket.js";

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

    public constructor(data?: DataType) {
        super(id, data);
    }
}
