import { logDebug, logError, logWarn } from "../../common/logging.js";
import PacketType from "../../common/packet/PacketType.js";
import { parsePacket } from "../../common/packet/parser.js";
import { getServersidePacketList } from "../../common/packet/reader.js";
import { GenThumbnailPacket } from "../../common/packet/s2t/GenThumbnailPacket.js";
import { ThumbnailDataPacket } from "../../common/packet/t2s/ThumbnailDataPacket.js";
import type { FileHandle } from "../../common/supabase.js";
import { Database } from "../database/index.js";
import { Service } from "./Service.js";
import type { MessageEvent, WebSocket } from "ws";
import { createRequire } from "node:module";
import { sleep } from "../../common/useless.js";
import { getEnvironmentVariables } from "../../common/environment.js";

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
    public async addHandler(): Promise<boolean> {
        const { DISCORD_BOT_TOKEN } = getEnvironmentVariables("manager");
        const { MESSAGE_ENCRYPTION_KEY } = getEnvironmentVariables("crypto", true);
        const result = await this.sendConfiguration(this.config.name, {
            message_encryption_key: MESSAGE_ENCRYPTION_KEY,
            discord_bot_token: DISCORD_BOT_TOKEN
        });

        if (!result) return false;

        // These are only scheduled to be sent once we know that the service
        // has received its configuration properly.
        (async () => {
            const packets = ThumbnailService.getAndClearQueue();
            await sleep(0);
            logDebug("Sending queued thumbnails to service");
            for (const packet of packets) {
                this.sendPacket(new GenThumbnailPacket(packet));
                await sleep(50);
            }
        })();

        return true;
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
        if (!GenThumbnailPacket.prototype.isValidData({ id, ...data })) {
            logWarn("Tried adding invalid data to the thumbnail queue", id, data);
            return;
        }
        // If already present, it'll just be overwritten
        ThumbnailService.queue.set(id, data);
    }

    public static removeQueueFileById(id: number): boolean {
        return ThumbnailService.queue.delete(id);
    }

    /**
     * Returns whether the file has been sent immediately to a service.
     */
    public static enqueueOrSendToRandom(handle: FileHandle): boolean {
        // This is a VERY HACKY way to bypass circular imports from ./list.ts
        // As that file imports ThumbnailService for it's service registry,
        // we here also import that file - something which results in an error.
        // FIXME: Remove that circular dependency (somehow?)
        const require = createRequire(import.meta.url);
        const { ServiceRegistry } = require("./list.js");
        const s = ServiceRegistry.random.all("thumbnail");
        const t = { messages: handle.messages, type: handle.type, channel: handle.channel };
        if (!s) {
            ThumbnailService.enqueueFile(handle.id, t);
            return false;
        }
        s.sendPacket(new GenThumbnailPacket({ ...t, id: handle.id }));
        return true;
    }

    public static getAndClearQueue() {
        // These can flow directly into GenThumbnailPacket
        const packets = ThumbnailService.queue.entries().map(([id, { messages, type, channel }]) => ({ id, messages, type, channel }));
        ThumbnailService.queue.clear();
        return packets;
    }

    public static shouldGenerateThumbnail(type: string) {
        // TOOD: Validate with actual types (although that is mainly done on the service itself)
        return type.startsWith("image/") || type.startsWith("video/");
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
