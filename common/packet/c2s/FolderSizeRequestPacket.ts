import { C2SPacket } from "../C2SPacket.js";
import type { SchemaToType } from "../../validator.js";

const id = "folder-size-request";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    /**
     * `null` indicates the root folder.
     */
    folder_id: { type: "number", min: 0, required: true, allow_null: true }
} as const;

/**
 * Allows the modification of a file share targeting a certain user.
 * Can create, modify or delete the file share for the inputted file.
 */
export class FolderSizeRequestPacket extends C2SPacket {
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
