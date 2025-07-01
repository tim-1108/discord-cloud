import type WebSocket from "ws";
import { Client } from "./Client.js";
import type { UUID } from "../../common/index.js";
import { S2CPacket } from "../../common/packet/S2CPacket.js";

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

type BroadcastValue = S2CPacket | null;
async function broadcast(handler: ((user: number) => Promise<BroadcastValue> | BroadcastValue) | S2CPacket) {
    for (const client of map.values()) {
        const packet = handler instanceof S2CPacket ? handler : await handler(client.getUserId());
        if (packet) {
            client.sendPacket(packet);
        }
    }
}

export const ClientList = {
    register,
    unregister,
    get,
    broadcast,
    all: map
} as const;
