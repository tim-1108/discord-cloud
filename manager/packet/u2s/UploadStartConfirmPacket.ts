import type { SchemaToType } from "../../utils/validator.ts";
import { U2SPacket } from "../U2SPacket.ts";

const id = "upload-start-confirm";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    accepted: { type: "boolean", required: true }
} as const;

export class UploadStartConfirmPacket extends U2SPacket {
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
