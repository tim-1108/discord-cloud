import { C2SPacket } from "../C2SPacket.js";
import { patterns } from "../../patterns.js";
import type { SchemaToType } from "../../validator.js";

const id = "file-share";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    path: { type: "string", required: true, pattern: patterns.stringifiedPath },
    name: { type: "string", required: true, pattern: patterns.fileName },
    target_user: { type: "number", required: true, min: 0 },
    /**
     * Either passed when adding or when looking to modify the share.
     */
    can_write: { type: "boolean", required: false },
    is_deleting: { type: "boolean", required: false }
} as const;

/**
 * Allows the modification of a file share targeting a certain user.
 * Can create, modify or delete the file share for the inputted file.
 */
export class FileSharePacket extends C2SPacket {
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
