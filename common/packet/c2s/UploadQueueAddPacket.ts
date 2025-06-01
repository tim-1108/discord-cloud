import { C2SPacket } from "../C2SPacket.js";
import { patterns } from "../../patterns.js";
import type { SchemaToType } from "../../validator.js";

const id = "upload-queue-add";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    name: { type: "string", required: true, pattern: patterns.fileName },
    path: { type: "string", required: true, pattern: patterns.stringifiedPath },
    // TODO: allow empty files to be uploaded
    size: { type: "number", required: true, min: 1 },
    is_public: { type: "boolean", required: true }
} as const;

export class UploadQueueAddPacket extends C2SPacket {
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
