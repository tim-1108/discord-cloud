import type { SchemaToType } from "../../validator.js";
import { T2SPacket } from "../T2SPacket.js";

const id = "thumbnail-data";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    id: { type: "number", required: true, min: 0 },
    success: { type: "boolean", required: true },
    /**
     * A base64 encoded data buffer containing a JPEG image
     */
    data: { type: "string", required: false }
} as const;

export class ThumbnailDataPacket extends T2SPacket {
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
