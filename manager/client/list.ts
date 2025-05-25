import type WebSocket from "ws";
import { Client } from "./Client.js";
import type { UUID } from "../../common/index.js";

const map = new Map<UUID, Client>();

function register(socket: WebSocket, userId: number): Client {
    const c = new Client(socket, userId);
    map.set(c.getUUID(), c);
    return c;
}

function unregister(c: Client): boolean;
function unregister(uuid: UUID): boolean;
function unregister(c: Client | UUID): boolean {
    let uuid = c instanceof Client ? c.getUUID() : c;
    return map.delete(uuid);
}

function get(uuid: UUID) {
    return map.get(uuid);
}

export const ClientList = {
    register,
    unregister,
    get
} as const;
