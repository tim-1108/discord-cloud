import { UploadService } from "./UploadService.js";
import type { Service } from "./Service.js";
import { WebSocket } from "ws";
import { ThumbnailService } from "./ThumbnailService.js";
import { logWarn } from "../../common/logging.js";

/**
 * Services have to be registered here
 */
const serviceRegistry = [ThumbnailService, UploadService] as const;

const serviceClassMap = new Map<string, typeof Service>();
for (const C of serviceRegistry) {
    const { name } = C.prototype.config;
    if (serviceClassMap.has(name)) {
        throw new Error("There are multiple services with the identifier " + name);
    }
    serviceClassMap.set(name, C);
}
const activeServices = new Map<string, Set<Service>>();
type ServiceClass = (typeof serviceRegistry)[number];
type ServiceName = ServiceClass["prototype"]["config"]["name"];
type ServiceClassMap = {
    [C in ServiceClass as C["prototype"]["config"]["name"]]: C;
};

function registerAndGetService<T extends ServiceClass>(name: string, socket: WebSocket) {
    // In this function's signature, we do not require the input name to be anything actually valid,
    // as the caller could not possibly match that type requirement.
    const ServiceClass = serviceClassMap.get(name) as T;
    if (!ServiceClass) {
        logWarn("Attempted to register unknown service type", name);
        // As the value entered here might come directly from user input (input from an authenticated service),
        // we do not throw an error in such a case as the input has not been validated against anything.
        return null;
    }

    const inst = new ServiceClass(socket);

    let set = activeServices.get(name);
    if (!set) {
        set = new Set();
        activeServices.set(name, set);
    }
    set.add(inst);

    // Stuff we call inside the instance
    inst.addHandler();
    socket.addEventListener("close", () => unregisterService(inst));

    return inst as T["prototype"];
}

function unregisterService(inst: Service) {
    const name = inst.config.name;
    const set = activeServices.get(name);
    if (!set) {
        return false;
    }
    const ret = set.delete(inst);
    if (!ret) {
        logWarn("Attempted to unregister an unknown service instance:", inst);
    }

    inst.removeHandler();
    return ret;
}

type Predicate<N extends ServiceName> = (value: InstanceType<ServiceClassMap[N]>, index: number) => boolean;

function getRandomService<N extends ServiceName>(name: N, predicate: Predicate<N>): InstanceType<ServiceClassMap[N]> | null {
    type S = InstanceType<ServiceClassMap[N]>;
    const set = activeServices.get(name) as Set<S> | undefined;
    if (!set) {
        return null;
    }

    const list = set.values().filter(predicate).toArray();
    if (!list.length) {
        return null;
    }

    const index = list.length > 1 ? crypto.getRandomValues(new Uint8Array(1))[0] % (list.length - 1) : 0;
    if (Number.isNaN(index)) {
        return null;
    }
    return list[index];
}

function getRandomIdleService<N extends ServiceName>(name: N) {
    return getRandomService(name, (value) => !value.isBusy());
}

function getServiceCount(name: ServiceName) {
    const set = activeServices.get(name);
    if (!set) {
        return { total: 0, idle: 0 };
    }
    const filtered = set
        .values()
        .filter((value) => !value.isBusy())
        .toArray();
    return { total: set.size, idle: filtered.length };
}

export const ServiceRegistry = {
    registerAndGet: registerAndGetService,
    unregister: unregisterService,
    random: {
        predicated: getRandomService,
        all: (name: ServiceName) => getRandomService(name, () => true),
        idle: getRandomIdleService
    },
    count: getServiceCount
} as const;
