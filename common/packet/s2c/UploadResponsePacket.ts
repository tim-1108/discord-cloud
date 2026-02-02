import { patterns } from "../../patterns.js";
import type { SchemaToType } from "../../validator.js";
import { S2CPacket } from "../S2CPacket.js";
import type { UUID } from "../../index.js";

const id = "upload-response";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    name: { type: "string", required: true, pattern: patterns.fileName },
    path: { type: "string", required: true, pattern: patterns.stringifiedPath },
    accepted: { type: "boolean", required: true },
    upload_address: { type: "string", required: false },
    chunk_size: { type: "number", required: true, min: 1 },
    rejection_reason: { type: "string", required: false },
    /**
     * If the file should happen to have been renamed (a file of the same
     * name already exists) this field notifies the client of that change.
     *
     * OF course, it can also be that no fitting replacement name can be
     * found. In such a case, the upload fails and the `rejection_reason`
     * field specifies that cause.
     */
    rename_target: { type: "string", required: false, pattern: patterns.fileName },
    upload_id: { type: "string", required: true, pattern: patterns.uuid }
} as const;

export class UploadResponsePacket extends S2CPacket {
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
