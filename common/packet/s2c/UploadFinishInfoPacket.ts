import type { SchemaToType } from "../../validator";
import { S2CPacket } from "../S2CPacket";
import { patterns } from "../../patterns";

const id = "upload-finish-info";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    success: { type: "boolean", required: true },
    upload_id: { type: "string", required: true, pattern: patterns.uuid },
    /**
     * Optional: (if known) why an upload completely failed
     */
    reason: { type: "string", required: false }
} as const;

export class UploadFinishInfoPacket extends S2CPacket {
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
