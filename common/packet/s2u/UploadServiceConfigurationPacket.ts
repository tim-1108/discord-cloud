import type { SchemaToType } from "../../validator.js";
import { S2UPacket } from "../S2UPacket.js";
import type { UUID } from "../../index.js";
import { patterns } from "../../patterns.js";

const id = "upload-service-configuration";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    crypto: {
        type: "conditional_record",
        required: true,
        options: [
            {
                enabled: { type: "boolean", required: true, expected: false }
            },
            {
                enabled: { type: "boolean", required: true, expected: true },
                key: { type: "string", required: true, min_length: 1 }
            }
        ]
    },
    discord_bot_token: { type: "string", required: true, min_length: 1 },
    discord_channel_id: { type: "string", required: true, pattern: patterns.snowflake }
} as const;

export class UploadServiceConfigurationPacket extends S2UPacket {
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
