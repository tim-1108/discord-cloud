import type { SchemaToType } from "../../validator.js";
import { GenericPacket } from "../GenericPacket.js";

const id = "primitives";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    boolean_value: { type: "boolean", required: false },
    integer_value: { type: "number", required: false },
    float_value: { type: "number", required: false, allow_floats: true },
    string_value: { type: "string", required: false }
} as const;

export class GenericPrimitivesPacket extends GenericPacket {
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
