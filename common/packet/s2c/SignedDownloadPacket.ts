import { patterns } from "../../patterns.js";
import type { SchemaToType } from "../../validator.js";
import { S2CPacket } from "../S2CPacket.js";
import type { UUID } from "../../index.js";

const id = "signed-download";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    /**
     * If `undefined`, the creation of the payload failed.
     */
    payload: { type: "string", required: false, pattern: patterns.base64Url }
} as const;

export class SignedDownloadPacket extends S2CPacket {
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
