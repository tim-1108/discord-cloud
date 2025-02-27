import { type ArraySchemaEntry, type SchemaToType } from "../../validator.js";
import { S2CPacket } from "../S2CPacket.js";
import type { UUID } from "../../index.js";

const id = "upload-queue-update";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    uploads: { type: "array", required: true } as ArraySchemaEntry<{ upload_id: UUID; queue_position: number }, undefined, true>
} as const;

export class UploadQueueUpdatePacket extends S2CPacket {
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
