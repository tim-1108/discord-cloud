import { UploadService } from "./UploadService.js";
import type { Service, ServiceParams } from "./Service.js";
import { WebSocket } from "ws";
import { ThumbnailService } from "./ThumbnailService.js";
import { logDebug, logWarn } from "../../common/logging.js";

/**
 * Services have to be registered here
 */
const serviceRegistry = [ThumbnailService, UploadService] as const;

const serviceClassMap = new Map<string, typeof Service>();
for (const C of serviceRegistry) {
    const { name } = C.getConfig();
    if (serviceClassMap.has(name)) {
        throw new Error("There are multiple services with the identifier " + name);
    }
    serviceClassMap.set(name, C);
}
const activeServices = new Map<string, Set<Service>>();
type ServiceClass = (typeof serviceRegistry)[number];
export type ServiceName = ServiceClass["prototype"]["config"]["name"];
type ServiceClassMap = {
    [C in ServiceClass as C["prototype"]["config"]["name"]]: C;
};
type GenericServiceParams = Record<string, string | null>;

function registerAndGetService(name: ServiceName, socket: WebSocket, params: GenericServiceParams | undefined) {
    type T = ServiceClassMap[typeof name];
    const $class = serviceClassMap.get(name) as T;
    // This is validated before being passed here
    if (!$class) {
        throw new ReferenceError("Failed to get service class for a previously validated type: " + name);
    }

    logDebug("Instantiating new service", name, params);

    const inst = new $class(socket, params as ServiceParams<T["prototype"]>);

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

/**
 * A util function for `getRandomService` and `getMultipleRandomServices`, as
 * both require the same list of services matching an optional predicate.
 */
function getPredicatedList<N extends ServiceName>(name: N, predicate?: Predicate<N>): InstanceType<ServiceClassMap[N]>[] {
    type S = InstanceType<ServiceClassMap[N]>;
    const set = activeServices.get(name) as Set<S> | undefined;
    if (!set) {
        return [];
    }
    return predicate ? set.values().filter(predicate).toArray() : Array.from(set);
}

function getRandomService<N extends ServiceName>(name: N, predicate?: Predicate<N>): InstanceType<ServiceClassMap[N]> | null {
    const list = getPredicatedList(name, predicate);
    if (!list.length) {
        return null;
    }

    if (list.length > 0xff) {
        // Although technically it would not fail, only services between indices 0 - 255 would ever be picked
        throw new RangeError("A service category may not have more than 255 services registered");
    }
    // A safe implementation - although that really does not matter - by generating just one uint8 value.
    const index = list.length > 1 ? crypto.getRandomValues(new Uint8Array(1))[0] % (list.length - 1) : 0;
    if (Number.isNaN(index)) {
        return null;
    }
    return list[index];
}

/**
 * If this function cannot fulfill `count`, it will return `null` instead of the array.
 */
function getMultipleRandomServices<N extends ServiceName>(
    name: N,
    count: number,
    predicate?: Predicate<N>
): InstanceType<ServiceClassMap[N]>[] | null {
    const list = getPredicatedList(name, predicate);
    if (count < 1 || list.length < count) {
        return null;
    }
    // for now, only return the first entries of the list (no randommmm)
    return list.slice(0, count);
}

function getRandomIdleService<N extends ServiceName>(name: N) {
    return getRandomService(name, (value) => !value.isBusy());
}

function getServiceCount<N extends ServiceName>(name: N, predicate?: Predicate<N>) {
    const set = activeServices.get(name);
    if (!set) {
        return { total: 0, idle: 0 };
    }

    if (predicate) {
        let i = 0;
        let c = 0;
        for (const service of set) {
            const flag = predicate(service as InstanceType<ServiceClassMap[N]>, i);
            if (flag) c++;
            i++;
        }
        // the field is named "idle" here to keep it in line with the rest of the function
        return { total: i, idle: c };
    }

    const filtered = set
        .values()
        .filter((value) => !value.isBusy())
        .toArray();
    return { total: set.size, idle: filtered.length };
}

function getServiceClassForName(name: string /* user input can be any string, not just of ServiceName */) {
    return serviceClassMap.get(name) ?? null;
}

export const ServiceRegistry = {
    registerAndGet: registerAndGetService,
    unregister: unregisterService,
    random: {
        predicated: getRandomService,
        all: (name: ServiceName) => getRandomService(name),
        idle: getRandomIdleService,
        multiple: getMultipleRandomServices
    },
    count: getServiceCount,
    classForName: getServiceClassForName
} as const;
