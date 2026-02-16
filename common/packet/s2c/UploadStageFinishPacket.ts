import type { SchemaToType } from "../../validator.js";
import { S2CPacket } from "../S2CPacket.js";
import { patterns } from "../../patterns.js";
import type { UUID } from "../../index.js";

const id = "upload-stage-finish";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    upload_id: { type: "string", required: true, pattern: patterns.uuid },
    service_disconnect: { type: "boolean", required: false }
} as const;

/**
 * This packet communicates to the client that the actual upload to Discord
 * has fully taken place and that the upload service is now free. This means
 * that the client may send now send another upload. The `UploadFinishInfoPacket`
 * is sent to the client once the metadata has been written to the database.
 *
 * This might not happen instantly because the server is awaiting a overwrite
 * response from the client. In such a case, the server waits for the client
 * to respond (user interaction), but the client should of course continue to
 * upload other files. Especially useful if the user should be away. It would
 * be rude to halt all uploads just because we wait for a overwrite conflict.
 */
export class UploadStageFinishPacket extends S2CPacket {
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
