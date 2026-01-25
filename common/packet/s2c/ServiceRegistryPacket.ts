import { patterns } from "../../patterns.js";
import type { SchemaToType } from "../../validator.js";
import { S2CPacket } from "../S2CPacket.js";

const id = "service-registry";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {
    // Passed only for upload services, and only when it is registered
    address: { type: "string", required: false },
    // This cannot just be imported from ServiceRegistry, as that is only available on the manager
    service_type: { type: "string", required: true, options: ["thumbnail", "upload"] },
    action: { type: "string", required: true, options: ["added", "removed", "list"] },
    service_uuid: { type: "string", required: true, pattern: patterns.uuid }
} as const;

/**
 * Updates the client on all the services that are registered
 */
export class ServiceRegistryPacket extends S2CPacket {
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
