import type { SchemaToType } from "../../validator.js";
import { S2CPacket } from "../S2CPacket.js";
import { patterns } from "../../patterns.js";
import { FolderHandleSchema } from "../../client.js";

const id = "folder-modify";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    path: { type: "string", required: true, pattern: patterns.stringifiedPath },
    handle: FolderHandleSchema,
    action: { type: "string", required: true, pattern: /^(add|delete|rename)$/ },
    /**
     * From what the folder has been renamed, if action is "rename".
     * This means that the client does not need to void its entire cache,
     * just rename their key inside layered a cache map.
     */
    rename_orgin: { type: "string", required: false }
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

    public constructor(data?: DataType) {
        super(id, data);
    }
}
