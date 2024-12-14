import { C2SPacket } from "../C2SPacket.js";
import { patterns } from "../../patterns.js";
import type { SchemaToType } from "../../validator.js";

const id = "list-request";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    path: { type: "string", required: true, pattern: patterns.stringifiedPath }
} as const;

export class ListRequestPacket extends C2SPacket {
    protected declare data: DataType;
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
