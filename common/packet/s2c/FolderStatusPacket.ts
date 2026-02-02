import { patterns } from "../../patterns.js";
import type { SchemaToType } from "../../validator.js";
import { S2CPacket } from "../S2CPacket.js";
import type { UUID } from "../../index.js";

const id = "folder-status";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    path: { type: "string", required: true, pattern: patterns.stringifiedPath },
    folder_id: { type: "number", required: true, min: 0, allow_null: true },
    exists: { type: "boolean", required: true },
    file_count: { type: "number", required: true, min: 0 },
    subfolder_count: { type: "number", required: true, min: 0 },
    /**
     * A constant value the server uses to split the data into pages
     */
    page_size: { type: "number", required: true, min: 1 }
} as const;

/**
 * Retrieves whether the folder at this path exists in addition
 * to a count of subfolders and files to build page counts.
 */
export class FolderStatusPacket extends S2CPacket {
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
