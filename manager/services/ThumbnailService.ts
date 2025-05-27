import { logDebug, logError, logWarn } from "../../common/logging.js";
import PacketType from "../../common/packet/PacketType.js";
import { parsePacket } from "../../common/packet/parser.js";
import { getServersidePacketList } from "../../common/packet/reader.js";
import { GenThumbnailPacket } from "../../common/packet/s2t/GenThumbnailPacket.js";
import { ThumbnailDataPacket } from "../../common/packet/t2s/ThumbnailDataPacket.js";
import { Database } from "../database/index.js";
import { Service, type ServiceParams } from "./Service.js";
import type { MessageEvent, WebSocket } from "ws";

interface ThumbnailGenerationData {
    messages: string[];
    channel: string;
    type: string;
}

const config = {
    maxAmount: 1,
    name: "thumbnail"
} as const;

export class ThumbnailService extends Service {
    public config = config;
    public static override getConfig() {
        return config;
    }
    public addHandler(): void {
        const packets = ThumbnailService.getAndClearQueue();
        logDebug("Sending queued thumbnails to service");
        for (const packet of packets) {
            // FIXME: These packets do not yet seem to arrive! (too early?)
            this.sendPacket(new GenThumbnailPacket(packet));
        }
    }
    public removeHandler(): void {}
    /**
     * This queue is different from what the thumbnail service itself keeps.
     * It is responsible for storing all those images for whom thumbnails should
     * be generated when at the moment of upload, no thumbnail service is connected
     * to the manager.
     *
     * Upon a connection of one, this queue is flushed and sent.
     */
    private static queue = new Map<number, ThumbnailGenerationData>();
    public static enqueueFile(id: number, data: ThumbnailGenerationData) {
        logDebug("Queuing thumbnail to be geenerated for", id, data);
        if (!GenThumbnailPacket.prototype.isValidData({ id, ...data })) {
            logWarn("Tried adding invalid data to the thumbnail queue", id, data);
            return;
        }
        this.queue.set(id, data);
    }

    public static removeQueueFileById(id: number): boolean {
        return this.queue.delete(id);
    }

    public static getAndClearQueue() {
        // These can flow directly into GenThumbnailPacket
        const packets = this.queue.entries().map(([id, { messages, type, channel }]) => ({ id, messages, type, channel }));
        this.queue.clear();
        return packets;
    }

    public constructor(socket: WebSocket, params?: Record<string, string | null>) {
        super(socket, params);
    }

    protected handleSocketMessage(event: MessageEvent): void {
        const packet = parsePacket(event.data, PacketType.Thumbnail2Server, getServersidePacketList);
        if (packet === null) {
            return;
        }
        this.resolveReplies(packet);

        if (packet instanceof ThumbnailDataPacket) {
            const data = packet.getData();
            if (!data.success || !data.data) return;
            const buf = Buffer.from(data.data, "base64url");
            saveThumbnail(data.id, buf);
        }
    }
}

async function saveThumbnail(id: number, buf: Buffer) {
    const status = await Database.thumbnail.upload(id, buf);
    if (!status) {
        return;
    }
    const handle = Database.file.update(id, { has_thumbnail: true });
    if (handle === null) {
        logError("Stored a thumbnail for a file that does not exist:", id);
    }
}
