import type { SchemaToType } from "../../validator.js";
import { S2CPacket } from "../S2CPacket.js";

const id = "upload-services";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    /**
     * The amount of services successfully booked for this client.
     */
    count: { type: "number", required: true, min: 0 }
} as const;

export class UploadServicesPacket extends S2CPacket {
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
