import { patterns } from "../../patterns.js";
import type { SchemaToType } from "../../validator.js";
import { S2UPacket } from "../S2UPacket.js";
import type { UUID } from "../../index.js";

const id = "upload-start";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    name: { type: "string", required: true, pattern: patterns.fileName },
    path: { type: "string", required: true, pattern: patterns.stringifiedPath },
    size: { type: "number", required: true, min: 0 },
    client: { type: "string", required: true, pattern: patterns.uuid },
    upload_id: { type: "string", required: true, pattern: patterns.uuid },
    chunk_size: { type: "number", required: true, min: 1 }
} as const;

export class UploadStartPacket extends S2UPacket {
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
