import { C2SPacket } from "../C2SPacket.ts";
import { patterns } from "../../utils/patterns.ts";
import type { SchemaToType } from "../../utils/validator.ts";

export class UploadQueueAddPacket extends C2SPacket {
	protected declare data: SchemaToType<typeof this.dataStructure> | null;

	public getData() {
		return this.data;
	}

	public constructor() {
		super("upload-queue-add");
	}

	public readonly dataStructure = {
		name: { type: "string", required: true, pattern: patterns.fileName },
		path: { type: "string", required: true, pattern: patterns.stringifiedPath },
		size: { type: "number", required: true, min: 0 }
	} as const;
}
