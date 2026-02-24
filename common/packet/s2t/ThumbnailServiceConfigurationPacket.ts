import { patterns } from "../../patterns.js";
import type { SchemaToType } from "../../validator.js";
import { S2TPacket } from "../S2TPacket.js";
import type { UUID } from "../../index.js";

const id = "thumbnail-service-configuration";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    /**
     * If not specified, the thumbnail service will not be able to decrypt
     * any messages should the file be encrypted.
     */
    message_encryption_key: { type: "string", required: false, min_length: 1 },
    discord_bot_token: { type: "string", required: true, min_length: 1 }
} as const;

function validateMessageIds(obj: any): boolean {
    if (!Array.isArray(obj) || !obj.length) return false;
    return obj.every((value) => typeof value === "string" && patterns.snowflake.test(value));
}

export class ThumbnailServiceConfigurationPacket extends S2TPacket {
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
