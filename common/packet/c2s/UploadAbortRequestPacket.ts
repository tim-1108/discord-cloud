import { C2SPacket } from "../C2SPacket.js";
import { patterns } from "../../patterns.js";
import type { SchemaToType } from "../../validator.js";
import type { UUID } from "../../index.js";

const id = "upload-abort-request";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    upload_id: { type: "string", required: true, pattern: patterns.uuid }
} as const;

export class UploadAbortRequestPacket extends C2SPacket {
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
