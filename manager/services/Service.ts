import type { ServiceConfig } from "./list.ts";
import { PacketReceiver } from "../../common/packet/PacketReceiver.ts";

/**
 * Services are registered by {@link HttpHandler} and are automatically
 * dismissed by it.
 */
export abstract class Service extends PacketReceiver {
    /**
     * Represents the URL of the service.
     *
     * Should not contain any protocols (just (sub-)domains)
     * @private
     * @readonly
     */
    protected readonly config: ServiceConfig;
    /**
     * Whether the service is currently processing
     * user data. If so, it cannot be chosen to receive
     * another until it notifies this manager in a finish packet.
     * @private
     */
    private busy: boolean = false;

    protected constructor(config: ServiceConfig) {
        super(config.socket);
        this.config = config;
    }

    public isBusy() {
        return this.busy;
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
