import { type ArraySchemaEntry, type SchemaToType } from "../../validator";
import { S2CPacket } from "../S2CPacket";
import type { UUID } from "../../index";

const id = "upload-queue-update";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    uploads: { type: "array", required: true } as ArraySchemaEntry<{ upload_id: UUID; queue_position: number }, undefined, true>
} as const;

export class UploadQueueUpdatePacket extends S2CPacket {
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
