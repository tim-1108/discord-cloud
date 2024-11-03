import { patterns } from "../../utils/patterns.ts";
import type { SchemaToType } from "../../utils/validator.ts";
import { S2UPacket } from "../S2UPacket.ts";

export class UploadStartPacket extends S2UPacket {
    protected declare data: DataType;

    public static ID = "upload-start";

    public getData() {
        return this.data;
    }

    public constructor(data?: DataType) {
        super(UploadStartPacket.ID, data);
    }

    public readonly dataStructure = {
        name: { type: "string", required: true, pattern: patterns.fileName },
        path: { type: "string", required: true, pattern: patterns.stringifiedPath },
        size: { type: "number", required: true, min: 0 },
        client: { type: "string", required: true, pattern: patterns.uuid }
    } as const;
}

type DataType = SchemaToType<UploadStartPacket["dataStructure"]>;
