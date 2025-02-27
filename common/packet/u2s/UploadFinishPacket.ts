import type { SchemaToType } from "../../validator.js";
import { U2SPacket } from "../U2SPacket.js";
import { patterns } from "../../patterns.js";

const id = "upload-finish";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    success: { type: "boolean", required: true },
    messages: { type: "array", item_type: "string", required: false },
    hash: { type: "string", required: false, pattern: patterns.hash },
    is_encrypted: { type: "boolean", required: false },
    type: { type: "string", required: false },
    channel: { type: "string", required: false, pattern: patterns.snowflake },
    /**
     * Can be provided whenever the upload fails
     */
    reason: { type: "string", required: false }
} as const;

export class UploadFinishPacket extends U2SPacket {
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
