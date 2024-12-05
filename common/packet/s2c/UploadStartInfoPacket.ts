import { patterns } from "../../patterns.ts";
import type { SchemaToType } from "../../validator.ts";
import { S2CPacket } from "../S2CPacket.ts";

const id = "upload-start-info";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    chunks: { type: "array", item_type: "number", required: true },
    upload_id: { type: "string", pattern: patterns.uuid, required: true },
    address: { type: "string", required: true }
} as const;

export class UploadStartInfoPacket extends S2CPacket {
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
