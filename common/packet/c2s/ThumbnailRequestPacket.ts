import { C2SPacket } from "../C2SPacket.js";
import type { SchemaToType } from "../../validator.js";

const id = "thumbnail-request";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    id: { type: "number", required: true, min: 0 }
} as const;

export class ThumbnailRequestPacket extends C2SPacket {
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
