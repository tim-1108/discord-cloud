import type { WebSocket } from "ws";
import { PacketReceiver } from "../../common/packet/PacketReceiver.js";
import type { SchemaEntryConsumer, SchemaToType } from "../../common/validator.js";
import type { UUID } from "../../common/index.js";

export interface ServiceConfiguration {
    maxAmount?: number;
    name: string;
    params?: SchemaEntryConsumer;
}

export type ServiceParams<S extends Service> = S["config"]["params"] extends SchemaEntryConsumer ? SchemaToType<S["config"]["params"]> : undefined;

/**
 * Services are registered by {@link HttpHandler} and are automatically
 * dismissed by it.
 */
export abstract class Service extends PacketReceiver {
    public abstract readonly config: ServiceConfiguration;
    public static getConfig(): ServiceConfiguration {
        return { name: "" };
    }
    public abstract addHandler(): void;
    public abstract removeHandler(): void;

    protected params: ServiceParams<any> | null;

    /**
     * No Service subclass has to implement this function, as their
     * removeHandler method will get called. Yes, this is confusing
     * design and should be changed.
     */
    protected handleSocketClose() {}

    /**
     * Whether the service is currently processing
     * user data. If so, it cannot be chosen to receive
     * another until it notifies this manager in a finish packet.
     * @private
     */
    private busy: boolean = false;

    /**
     * A value to help identify individual services on the client-side
     * when broadcasted via {@link ServiceRegistryPacket}s. This serves
     * no other use as of now.
     */
    private uuid: UUID;

    protected constructor(socket: WebSocket, params: ServiceParams<any> | undefined /* declared explicitly to force subclass pass parameter */) {
        super(socket);
        this.params = params ?? null;
        this.uuid = crypto.randomUUID();
    }

    public isBusy(): boolean {
        return this.busy;
    }

    public getServiceUUID(): UUID {
        return this.uuid;
    }

    /**
     * This method provides a more explicit call than setBusy(true)
     */
    protected markBusy() {
        this.busy = true;
    }

    /**
     * This method provides a more explicit call than setBusy(false)
     */
    protected markNotBusy() {
        this.busy = false;
    }
}
