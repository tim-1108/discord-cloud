import type { SchemaToType } from "../../validator.js";
import { S2CPacket } from "../S2CPacket.js";

const id = "upload-booking-modify";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    /**
     * By how much the amount of available upload services for this booking has changed.
     * If an uploader disconnected (the service was shut down) this is communicated via -1.
     *
     * This does not indicate a change in the desired amount the client has requested,
     * only that their actual available count (communicated in the original reply) has
     * increased or decreased and can thus be used.
     */
    effective_change: { type: "number", required: true }
} as const;

export class UploadBookingModifyPacket extends S2CPacket {
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
