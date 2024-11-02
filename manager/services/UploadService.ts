import { Service } from "./Service.ts";
import type { ServiceConfig } from "./list.ts";

export class UploadService extends Service {
	public constructor(config: ServiceConfig) {
		super(config);
	}
}
