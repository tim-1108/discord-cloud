import { patterns } from "../../patterns.js";
import type { SchemaToType } from "../../validator.js";
import { S2CPacket } from "../S2CPacket.js";

const id = "upload-start-info";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    chunk_size: { type: "number", required: true, min: 1 },
    upload_id: { type: "string", pattern: patterns.uuid, required: true },
    address: { type: "string", required: true }
} as const;

export class UploadStartInfoPacket extends S2CPacket {
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
