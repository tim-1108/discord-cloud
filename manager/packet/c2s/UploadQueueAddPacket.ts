import { C2SPacket } from "../C2SPacket.ts";
import { patterns } from "../../utils/patterns.ts";
import type { SchemaToType } from "../../utils/validator.ts";

const id = "upload-queue-add";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    name: { type: "string", required: true, pattern: patterns.fileName },
    path: { type: "string", required: true, pattern: patterns.stringifiedPath },
    size: { type: "number", required: true, min: 0 }
} as const;

export class UploadQueueAddPacket extends C2SPacket {
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
