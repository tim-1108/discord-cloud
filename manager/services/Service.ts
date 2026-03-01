import type { WebSocket } from "ws";
import { PacketReceiver } from "../../common/packet/PacketReceiver.js";
import type { SchemaEntryConsumer, SchemaToType } from "../../common/validator.js";
import type { UUID } from "../../common/index.js";
import { type ServiceName } from "./list.js";
import { GenericBooleanPacket } from "../../common/packet/generic/GenericBooleanPacket.js";
import { UploadServiceConfigurationPacket } from "../../common/packet/s2u/UploadServiceConfigurationPacket.js";
import { ThumbnailServiceConfigurationPacket } from "../../common/packet/s2t/ThumbnailServiceConfigurationPacket.js";

export interface ServiceConfiguration {
    /**
     * TODO: Implement this variable
     */
    maxAmount?: number;
    name: ServiceName;
    params?: SchemaEntryConsumer;
}

/**
 * Not all services have to have a configuration packet and thus
 * only those which need one are defined here with the corresponding packet.
 *
 * This has to reside outside of `list.ts`, otherwise there would be a
 * circular dependency of imports. `Service.ts` would import the list,
 * which imports the upload and thumbnail services. But these require
 * `Service.ts`, which has in that case not yet been created.
 */
const serviceConfigurationPacket = {
    upload: UploadServiceConfigurationPacket,
    thumbnail: ThumbnailServiceConfigurationPacket
} as const;

export type ServiceParams<S extends Service> = S["config"]["params"] extends SchemaEntryConsumer ? SchemaToType<S["config"]["params"]> : undefined;

/**
 * Services are registered by {@link HttpHandler} and are automatically
 * dismissed by it.
 */
export abstract class Service extends PacketReceiver {
    public abstract readonly config: ServiceConfiguration;
    public static getConfig(): ServiceConfiguration {
        throw new Error("Not implemented by subclass of Service");
    }
    public abstract addHandler(): boolean | Promise<boolean>;
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

    /**
     * Sends the configuration packet that the service wants.
     */
    protected async sendConfiguration<Name extends typeof this.config.name>(
        name: Name,
        data: Name extends keyof typeof serviceConfigurationPacket
            ? ReturnType<InstanceType<(typeof serviceConfigurationPacket)[Name]>["getData"]>
            : null
    ): Promise<boolean> {
        if (data === null) return false;
        // We know that Name is within the keyof union if we got here.
        const packetClass = serviceConfigurationPacket[name as keyof typeof serviceConfigurationPacket];
        // Just a safety precaucion, although this should be impossible.
        if (!packetClass) return false;
        // @ts-expect-error all of this is not pretty!
        const packet = new packetClass(data);
        const reply = await this.sendPacketAndReply_new(packet, GenericBooleanPacket);
        if (!reply.packet) {
            return false;
        }
        const { success } = reply.packet.getData();
        return success;
    }
}
