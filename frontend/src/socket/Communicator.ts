import { globals } from "@/composables/globals.js";
import { PacketReceiver } from "../../../common/packet/PacketReceiver.js";
import { parsePacket } from "../../../common/packet/parser.js";
import { getBrowserClientboundPacketList } from "./packets.js";
import { useCurrentRoute } from "@/composables/path.js";
import PacketType from "../../../common/packet/PacketType.js";
import { UploadQueueUpdatePacket } from "../../../common/packet/s2c/UploadQueueUpdatePacket.js";
import { Uploads } from "@/composables/uploads.js";
import { UploadStartInfoPacket } from "../../../common/packet/s2c/UploadStartInfoPacket.js";
import { FileModifyPacket } from "../../../common/packet/s2c/FileModifyPacket.js";
import { listingFileModify } from "@/composables/listing.js";
import { logWarn } from "../../../common/logging.js";
import { Dialogs } from "@/composables/dialog.js";

/**
 * The class that communicates with the manager using a web socket.
 */
export class Communicator extends PacketReceiver {
    public constructor(address: string) {
        const socket = new WebSocket(address);
        super(socket);
        this.socket.addEventListener("open", async () => {
            const result = await globals.listing.fetch(useCurrentRoute().value);
            globals.listing.writeActive(result);
        });
    }

    protected handleSocketClose(event: CloseEvent): void {
        // TODO: Replace with better error handler (reconnection and show to user)
        logWarn(`The socket connection was lost with code ${event.code} and reason "${event.reason || "unknown"}"`);
        Dialogs.alert({
            title: "Connection lost",
            body: "You have lost connection to the server. Please reload the page and check the developer console. Also consider logging off and logging back in again."
        });
    }
    protected handleSocketMessage(event: MessageEvent): void {
        const packet = parsePacket(event.data, PacketType.Server2Client, getBrowserClientboundPacketList);
        if (!packet) return;
        const hasResolved = this.resolveReplies(packet);
        if (hasResolved) {
            return;
        }

        if (packet instanceof UploadQueueUpdatePacket) {
            return Uploads.queue.advance(packet);
        }
        if (packet instanceof UploadStartInfoPacket) {
            return void Uploads.start(packet);
        }
        if (packet instanceof FileModifyPacket) {
            return listingFileModify(packet);
        }
    }
}
