import type { SchemaToType } from "../../utils/validator.ts";
import { U2SPacket } from "../U2SPacket.ts";

export class UploadStartConfirmPacket extends U2SPacket {
    protected declare data: DataType;

    public static ID = "upload-start-confirm";

    public getData() {
        return this.data;
    }

    public constructor(data?: DataType) {
        super(UploadStartConfirmPacket.ID, data);
    }

    public readonly dataStructure = {
        accepted: { type: "boolean", required: true }
    } as const;
}

type DataType = SchemaToType<UploadStartConfirmPacket["dataStructure"]>;
