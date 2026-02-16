import { C2SPacket } from "../C2SPacket.js";
import { patterns } from "../../patterns.js";
import type { SchemaToType } from "../../validator.js";
import type { UUID } from "../../index.js";

const id = "upload-request";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    name: { type: "string", required: true, pattern: patterns.fileName },
    path: { type: "string", required: true, pattern: patterns.stringifiedPath },
    size: { type: "number", required: true, min: 1 },
    /**
     * If `true`, the file will be marked as `public`, allowing anyone to read it.
     */
    is_public: { type: "boolean", required: true },
    /**
     * If `true`, the server will never ask the client for any overwrite confirmation,
     * nor allow for skipping or renaming of the file. If the file cannot be overwritten,
     * the upload fails.
     */
    do_overwrite: { type: "boolean", required: false }
} as const;

export class UploadRequestPacket extends C2SPacket {
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
