import { UploadService } from "./UploadService.ts";
import type { Service } from "./Service.ts";

/**
 * These uploader services are connected and ready to work!
 */
const uploadServices = new Set<UploadService>();

/**
 * Returns a random uploader that is ready to use.
 */
export function findRandomUploadService() {
	const list = Array.from(uploadServices).filter((service) => service.isBusy());
	if (!list.length) return null;
	// More secure than Math.random, gets a value for an index
	const index = crypto.getRandomValues(new Uint8Array(1))[0] % (list.length - 1);
	return list[index];
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
			return { add: () => uploadServices.add(service), delete: () => uploadServices.delete(service) };
		}
		default: {
			// In any situation where this CAN even be called, this should never fail.
			// Assumes an assertion, like in createService has already taken place.
			throw new Error("Failed to find type for service");
		}
	}
}
