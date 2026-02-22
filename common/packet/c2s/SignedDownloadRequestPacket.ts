import { C2SPacket } from "../C2SPacket.js";
import type { SchemaToType } from "../../validator.js";
import type { UUID } from "../../index.js";

const id = "signed-download-request";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    file_id: { type: "number", required: true, min: 0 }
} as const;

export class SignedDownloadRequestPacket extends C2SPacket {
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
