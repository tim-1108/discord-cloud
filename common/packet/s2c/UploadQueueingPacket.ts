import type { SchemaToType } from "../../validator.js";
import { S2CPacket } from "../S2CPacket.js";

const id = "upload-queueing";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    path: { type: "string", required: true },
    size: { type: "number", required: true },
    name: { type: "string", required: true },
    upload_id: { type: "string", required: true },
    queue_position: { type: "number", required: true }
} as const;

export class UploadQueueingPacket extends S2CPacket {
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
