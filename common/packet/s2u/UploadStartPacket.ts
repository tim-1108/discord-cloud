import { patterns } from "../../patterns.ts";
import type { SchemaToType } from "../../validator.ts";
import { S2UPacket } from "../S2UPacket.ts";

const id = "upload-start";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    name: { type: "string", required: true, pattern: patterns.fileName },
    path: { type: "string", required: true, pattern: patterns.stringifiedPath },
    size: { type: "number", required: true, min: 0 },
    client: { type: "string", required: true, pattern: patterns.uuid },
    upload_id: { type: "string", required: true, pattern: patterns.uuid }
} as const;

export class UploadStartPacket extends S2UPacket {
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
