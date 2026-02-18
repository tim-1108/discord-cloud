import readline from "node:readline";
import { stdin, stdout } from "node:process";
import { parsePacket } from "../common/packet/parser.js";
import PacketType from "../common/packet/PacketType.js";
import { getServersidePacketList } from "../common/packet/reader.js";
import { logDebug, logError } from "../common/logging.js";
import { ClientList } from "./client/list.js";

const rl = readline.createInterface({ input: stdin, output: stdout });

function parse(input: string) {
    if (input.startsWith("c:")) {
        const packet = parsePacket(input.substring(2), PacketType.Server2Client, getServersidePacketList);
        if (!packet) {
            logError("Invalid packet!");
            return;
        }
        packet.markAsDebugPacket();
        logDebug("Broadcast packet:", packet.id, packet.getData());
        ClientList.broadcast(packet);
    }
}

rl.on("line", parse);
