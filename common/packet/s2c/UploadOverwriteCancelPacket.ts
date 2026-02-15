import type { SchemaToType } from "../../validator.js";
import { S2CPacket } from "../S2CPacket.js";
import type { UUID } from "../../index.js";

const id = "upload-overwrite-cancel";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {} as const;

/**
 * Tells the client to clear all overwrites in the queue as the
 * client has presumbably told the server to use either `rename`
 * or `overwrite` for all files within the current booking by
 * previosly transmitting that within the response packet.
 */
export class UploadOverwriteCancelPacket extends S2CPacket {
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
