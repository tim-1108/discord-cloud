import { UploadService } from "./UploadService.ts";
import type { Service } from "./Service.ts";
import { sendUploadsToServices } from "../utils/uploads.ts";

/**
 * These uploader services are connected and ready to work!
 */
const uploadServices = new Set<UploadService>();

/**
 * Returns a random uploader that is ready to use.
 */
export function findRandomUploadService() {
    const list = getFilteredUploadServices((service) => !service.isBusy());
    if (!list.length) return null;
    // More secure than Math.random, gets a value for an index
    // When length of list would only be 1, diving by 0 => NaN
    const index = list.length > 1 ? crypto.getRandomValues(new Uint8Array(1))[0] % (list.length - 1) : 0;
    if (Number.isNaN(index)) return null;
    return list[index];
}

function getFilteredUploadServices(filter: (service: UploadService) => boolean) {
    return Array.from(uploadServices).filter(filter);
}

export function getUploadServiceCount() {
    return { total: uploadServices.size, busy: getFilteredUploadServices((service) => service.isBusy()).length };
}

export interface ServiceConfig {
    address: string;
    socket: WebSocket;
}

export function createService(type: string, config: ServiceConfig) {
    let service: Service | null = null;
    switch (type) {
        case "upload": {
            service = new UploadService(config);
            break;
        }
        default: {
            // Note: This means a service WITH a valid auth key has tried to register a non-existent type
            console.warn("Invalid service type has been requested.");
        }
    }
    return service;
}

export function findMethodsForServiceType(service: Service) {
    switch (service.constructor) {
        case UploadService: {
            return {
                add: () => {
                    uploadServices.add(<UploadService>service);
                    void sendUploadsToServices();
                },
                delete: () => uploadServices.delete(<UploadService>service)
            };
        }
        default: {
            // In any situation where this CAN even be called, this should never fail.
            // Assumes an assertion, like in createService has already taken place.
            throw new Error("Failed to find type for service");
        }
    }
}
