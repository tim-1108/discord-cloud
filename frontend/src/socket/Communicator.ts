import { updateListingForCurrentDirectory } from "@/composables/listing.js";
import { logInfo } from "../../../common/logging.js";
import { PacketReceiver } from "../../../common/packet/PacketReceiver.js";
import { PacketType, parsePacket } from "../../../common/packet/parser.js";
import { getBrowserClientboundPacketList, getBrowserServerboundPacketList } from "./packets.js";

/**
 * The class that communicates with the manager using a web socket.
 */
export class Communicator extends PacketReceiver {
    public constructor() {
        // TODO: Load socket url at build time or from env
        const socket = new WebSocket("");
        super(socket);
        socket.addEventListener("open", () => {
            this.initialize();
            updateListingForCurrentDirectory();
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
