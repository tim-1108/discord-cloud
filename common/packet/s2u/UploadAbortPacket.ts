import type { SchemaToType } from "../../validator.js";
import { S2UPacket } from "../S2UPacket.js";
import type { UUID } from "../../index.js";

const id = "upload-abort";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {} as const;

export class UploadAbortPacket extends S2UPacket {
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
