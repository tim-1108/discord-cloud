import { C2SPacket } from "../C2SPacket.js";
import type { SchemaToType } from "../../validator.js";
import type { UUID } from "../../index.js";

const id = "transfer-ownership";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    file_id: { type: "number", required: true, min: 0 },
    target_user_id: { type: "number", required: true, min: 0 },
    /**
     * If `true`, all file shares existing for this file will be removed.
     * If a file share towards the desired owner exists, it will be deleted
     * no matter what.
     */
    delete_file_shares: { type: "boolean", required: false },
    /**
     * If `true`, the user who currently owns this file (so the user
     * using this packet) will have a file share with full read and
     * write access installed.
     */
    create_share_for_current_owner: { type: "boolean", required: false }
} as const;

export class TransferOwnershipPacket extends C2SPacket {
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
