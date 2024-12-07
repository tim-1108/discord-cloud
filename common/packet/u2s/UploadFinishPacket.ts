import type { SchemaToType } from "../../validator.ts";
import { U2SPacket } from "../U2SPacket.ts";
import { patterns } from "../../patterns.ts";

const id = "upload-finish";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    success: { type: "boolean", required: true },
    messages: { type: "array", item_type: "string", required: false },
    hash: { type: "string", required: false, pattern: patterns.hash },
    is_encrypted: { type: "boolean", required: false },
    type: { type: "string", required: false },
    /**
     * Can be provided whenever the upload fails
     */
    reason: { type: "string", required: false }
} as const;

export class UploadFinishPacket extends U2SPacket {
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
