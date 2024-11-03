import { C2SPacket } from "../C2SPacket.ts";
import { patterns } from "../../utils/patterns.ts";
import type { SchemaToType } from "../../utils/validator.ts";

export class UploadQueueAddPacket extends C2SPacket {
    protected declare data: DataType;

    public static ID = "upload-queue-add";

    public getData() {
        return this.data;
    }

    public constructor(data?: DataType) {
        super(UploadQueueAddPacket.ID, data);
    }

    public readonly dataStructure = {
        name: { type: "string", required: true, pattern: patterns.fileName },
        path: { type: "string", required: true, pattern: patterns.stringifiedPath },
        size: { type: "number", required: true, min: 0 }
    } as const;
}

type DataType = SchemaToType<UploadQueueAddPacket["dataStructure"]>;
