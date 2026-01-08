import { C2SPacket } from "../C2SPacket.js";
import { patterns } from "../../patterns.js";
import type { SchemaToType } from "../../validator.js";

const id = "list-request";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    path: { type: "string", required: true, pattern: patterns.stringifiedPath },
    type: { type: "string", required: true, options: ["subfolders", "files"] },
    page: { type: "number", required: true, min: 0 },
    sort_by: { type: "string", required: false, options: ["name", "updated_at", "size"] },
    /**
     * If specified, the sort will be ascending, if not or false,
     * the entries will be sorted decendingly.
     */
    ascending_sort: { type: "boolean", required: false }
} as const;

export class ListRequestPacket extends C2SPacket {
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
