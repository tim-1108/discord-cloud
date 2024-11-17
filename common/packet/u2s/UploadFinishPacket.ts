import type { SchemaToType } from "../../validator.ts";
import { U2SPacket } from "../U2SPacket.ts";

const id = "upload-finish";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {} as const;

export class UploadFinishPacket extends U2SPacket {
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
