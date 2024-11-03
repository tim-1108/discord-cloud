import { patterns } from "../../utils/patterns.ts";
import type { SchemaToType } from "../../utils/validator.ts";
import { S2UPacket } from "../S2UPacket.ts";

export class UploadStartPacket extends S2UPacket {
	protected declare data: DataType;

	public static ID = "s2u:upload-start";

	public getData() {
		return this.data;
	}

	public static DATA_STRUCTURE = {
		name: { type: "string", required: true, pattern: patterns.fileName },
		path: { type: "string", required: true, pattern: patterns.stringifiedPath },
		size: { type: "number", required: true, min: 0 },
		client: { type: "string", required: true, pattern: patterns.uuid }
	} as const;

	public readonly dataStructure = UploadStartPacket.DATA_STRUCTURE;

	public constructor(data?: DataType) {
		super("upload-start", data);
	}
}

type DataType = SchemaToType<UploadStartPacket["dataStructure"]>;
