import { C2SPacket } from "../C2SPacket.js";
import type { SchemaToType } from "../../validator.js";

const id = "upload-services-release";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {} as const;

/**
 * Frees the uploaders used by this client and releases them to be allocated
 * by other clients upon request of them.
 */
export class UploadServicesReleasePacket extends C2SPacket {
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
