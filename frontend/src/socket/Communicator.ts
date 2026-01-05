import { PacketReceiver } from "../../../common/packet/PacketReceiver.js";
import { parsePacket } from "../../../common/packet/parser.js";
import { getBrowserPacketList } from "./packets.js";
import PacketType from "../../../common/packet/PacketType.js";
import { Uploads } from "@/composables/uploads.js";
import { FileModifyPacket } from "../../../common/packet/s2c/FileModifyPacket.js";
import { logWarn } from "../../../common/logging.js";
import { Dialogs } from "@/composables/dialog.js";
import { Connection } from "@/composables/connection.js";
import { PendingAuthenticationState } from "@/composables/state.js";
import { UploadBookingModifyPacket } from "../../../common/packet/s2c/UploadBookingModifyPacket.js";
import { UploadFinishInfoPacket } from "../../../common/packet/s2c/UploadFinishInfoPacket.js";

/**
 * The class that communicates with the manager using a web socket.
 */
export class Communicator extends PacketReceiver {
    public constructor(address: URL) {
        const socket = new WebSocket(address);
        super(socket);
        this.socket.addEventListener("open", () => {
            PendingAuthenticationState.value = "established";
            Connection.isConnected.value = true;
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
        const packet = parsePacket(event.data, PacketType.Server2Client, getBrowserPacketList);
        if (!packet) return;
        const hasResolved = this.resolveReplies(packet);
        if (hasResolved) {
            return;
        }

        if (packet instanceof UploadBookingModifyPacket) {
            Uploads.packets.bookingModify(packet);
        } else if (packet instanceof UploadFinishInfoPacket) {
            Uploads.packets.uploadFinish(packet);
        } else if (packet instanceof FileModifyPacket) {
            //return listingFileModify(packet);
        }
    }
}
