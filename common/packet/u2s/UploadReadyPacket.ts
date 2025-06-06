import type { SchemaToType } from "../../validator.js";
import { U2SPacket } from "../U2SPacket.js";

const id = "upload-ready";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    accepted: { type: "boolean", required: true }
} as const;

export class UploadReadyPacket extends U2SPacket {
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
