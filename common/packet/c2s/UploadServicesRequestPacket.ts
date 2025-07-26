import { C2SPacket } from "../C2SPacket.js";
import type { SchemaToType } from "../../validator.js";

const id = "upload-services-request";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    /**
     * The amount of upload services the client wishes to book. That may not always
     * work as uploaders might already be assigned to other uploaders.
     *
     * The `count` parameter of the UploadServicesPacket includes the count of
     * the services that have actually been assigned towwards this client.
     */
    desired_amount: { type: "number", required: true, min: 1 }
} as const;

export class UploadServicesRequestPacket extends C2SPacket {
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
