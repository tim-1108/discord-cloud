import type { SchemaToType } from "../../validator.js";
import { S2CPacket } from "../S2CPacket.js";
import { patterns } from "../../patterns.js";
import { FolderHandleSchema } from "../../client.js";
import type { UUID } from "../../index.js";

const id = "folder-modify";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    path: { type: "string", required: true, pattern: patterns.stringifiedPath },
    handle: FolderHandleSchema,
    action: { type: "string", required: true, options: ["add", "delete", "rename", "move"] },
    /**
     * From what the folder has been renamed, if action is "rename".
     * This means that the client does not need to void its entire cache,
     * just rename their key inside layered a cache map.
     */
    rename_origin: { type: "string", required: false },
    /**
     * If the folder has been modified, the `parent_folder` field
     * may have been updated. If so, the old parent id is remarked here.
     */
    parent_folder_origin: { type: "number", required: false, min: 0, allow_null: true }
} as const;

export class FolderModifyPacket extends S2CPacket {
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
