import type { SchemaToType } from "../../validator.ts";
import { U2SPacket } from "../U2SPacket.ts";

const id = "upload-start-info";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    chunks: { type: "array", item_type: "number", required: true },
    accepted: { type: "boolean", required: true }
} as const;

export class UploadReadyPacket extends U2SPacket {
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
