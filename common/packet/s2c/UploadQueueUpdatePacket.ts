import { type SchemaToType } from "../../validator.js";
import { S2CPacket } from "../S2CPacket.js";

const id = "upload-queue-update";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    /**
     * From which index on the position is to be decreased
     */
    decrease_at: { type: "number", min: 0, required: true },
    /**
     * How many indices everything should move forward
     */
    decrease_by: { type: "number", min: 1, required: true }
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
