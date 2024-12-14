import { C2SPacket } from "../C2SPacket.js";
import type { SchemaToType } from "../../validator.js";

const id = "ping-services";

type DataType = SchemaToType<typeof dataStructure>;
const dataStructure = {} as const;

export class PingServicesPacket extends C2SPacket {
    protected declare data: DataType;
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
