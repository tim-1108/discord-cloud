import { globals } from "@/composables/globals.js";
import { PacketReceiver } from "../../../common/packet/PacketReceiver.js";
import { parsePacket } from "../../../common/packet/parser.js";
import { getBrowserClientboundPacketList } from "./packets.js";
import { useCurrentRoute } from "@/composables/path.js";
import { PacketType } from "../../../common/packet/definitions.js";

/**
 * The class that communicates with the manager using a web socket.
 */
export class Communicator extends PacketReceiver {
    public constructor(address: string) {
        const socket = new WebSocket(address);
        super(socket);
        this.initialize();
        this.socket.addEventListener("open", async () => {
            const result = await globals.listing.fetch(useCurrentRoute().value);
            globals.listing.writeActive(result);
        });
    }

    protected handleSocketClose(event: CloseEvent): void {
        // TODO: Replace with better error handler (reconnection and show to user)
        alert(`The socket connection was lost with code ${event.code} and reason "${event.reason || "unknown"}"`);
    }
    protected handleSocketMessage(event: MessageEvent): void {
        const packet = parsePacket(event.data, PacketType.Server2Client, getBrowserClientboundPacketList);
        if (!packet) return;
        const hasResolved = this.resolveReplies(packet);
    }
}
