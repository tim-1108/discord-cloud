import type { SchemaToType } from "../../validator.js";
import { patterns } from "../../patterns.js";
import type { UUID } from "../../index.js";
import { C2SPacket } from "../C2SPacket.js";

const id = "upload-overwrite-response";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    upload_id: { type: "string", required: true, pattern: patterns.uuid },
    /**
     */
    action: { type: "string", required: true, options: ["skip", "overwrite", "rename"] },
    /**
     * If `true`, the specified action in `action` will be used
     * for all upcoming uploads until the booking is cleared.
     */
    use_on_all_uploads: { type: "boolean", required: false }
} as const;

export class UploadOverwriteResponsePacket extends C2SPacket {
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
