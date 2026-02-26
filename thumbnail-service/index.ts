// This service is responsible for generating tiny preview images which may be viewed in the UI until the actual image has been loaded.
// Once a upload has been completed (and the file type is parsable by this service), we download the corresponding image from Discord
// and plug it into the "sharp" package to generate a tiny preview image.
// This may be uploaded to Supabase Storage (it ought to be no larger than 2kb).
// The problem with uploading to Discord are largely the decrypting and parsing times on the server,
// something we do not have to care with for Supabase Storage.

// This preview functionality should also extend to videos, however, there, we have to work with ffmpeg
// to actually take the screenshot of the first frame. "fluent-ffmpeg" ought to do the job.

// The theory of only downloading the first chunk should... work, as the video formats
// should work so that the majority of the latter end of the file can be missing.
// When it comes to huge images, that is another question.

import type { GenThumbnailPacket } from "../common/packet/s2t/GenThumbnailPacket.js";
import { enqueue, shiftQueue } from "../common/processing-queue.js";
import { Socket } from "./Socket.js";
import sharp from "sharp";
import ffmpeg from "fluent-ffmpeg";
import { Readable } from "node:stream";
import config from "./thumbnail-config.json" with { type: "json" };
import { logDebug, logError, logWarn } from "../common/logging.js";
import { ThumbnailDataPacket } from "../common/packet/t2s/ThumbnailDataPacket.js";
import express from "express";
import { Discord } from "../common/discord_new.js";
import { loadPackets } from "../common/packet/reader.js";
import { SymmetricCrypto } from "../common/symmetric-crypto.js";
import type { ThumbnailServiceConfigurationPacket } from "../common/packet/s2t/ThumbnailServiceConfigurationPacket.js";
import { GenericBooleanPacket } from "../common/packet/generic/GenericBooleanPacket.js";

await loadPackets();

const app = express();
app.listen(6000);
const socket = new Socket();

type Configuration = ThumbnailServiceConfigurationPacket["data"] & { defined: boolean };
let configuration: Configuration = { discord_bot_token: "", message_encryption_key: "", defined: false };
export function packet$configure(packet: ThumbnailServiceConfigurationPacket) {
    if (isConfigured()) {
        logWarn("Attempted to configure whilst being already configured");
        socket.replyToPacket(packet, new GenericBooleanPacket({ success: false }));
        return;
    }

    const data = packet.getData();

    configuration = { ...data, defined: true };
    Discord.initialize(data.discord_bot_token);
    if (data.message_encryption_key) {
        SymmetricCrypto.initialize(data.message_encryption_key);
    }
    socket.replyToPacket(packet, new GenericBooleanPacket({ success: true }));
}
function isConfigured(): boolean {
    return configuration.defined;
}

export async function processThumbnailRequest(packet: GenThumbnailPacket) {
    const data = packet.getData();
    console.log(data);
    const msgId = data.first_msg_id[0];
    const { file_id, channel_id, file_type, is_encrypted } = data;

    logDebug("Generating thumbnail for", data);
    await enqueue();

    const attachmentLink = await fetchAttachmentLinkOrFail(msgId, channel_id);
    if (attachmentLink === null) {
        shiftQueue();
        return;
    }

    const response = await Discord.cdn.fetch(attachmentLink);
    if (!response.buffer) {
        shiftQueue();
        return;
    }

    let buf = Buffer.from(response.buffer);
    if (is_encrypted) {
        const useLegacyDecryption = Discord.shouldUseLegacyDecryption(msgId);
        const cryptoFn = useLegacyDecryption ? SymmetricCrypto.decryptLegacy : SymmetricCrypto.decrypt;
        const $buf = cryptoFn(buf);
        if (!$buf) {
            logError("Failed to decrypt message %s, it may have been tampered with", msgId);
            shiftQueue();
            return;
        }
        buf = $buf;
    }
    const func = getGeneratingFunctionForFileType(file_type);

    try {
        const screenshot = await func(buf, file_type);
        socket.sendPacket(new ThumbnailDataPacket({ file_id, success: true, data: screenshot.toString("base64url") }));
    } catch (error) {
        console.error(error);
        socket.sendPacket(new ThumbnailDataPacket({ file_id, success: false, data: undefined }));
    }

    shiftQueue();
}

type ThumbnailGeneratorFunction = (buf: Buffer, type: string) => Promise<Buffer>;

function getGeneratingFunctionForFileType(type: string): ThumbnailGeneratorFunction {
    // As the uploader service determined the file type we read here,
    // we can be sure (check this?) of the actual files contents.
    // TODO: Better actual validation of supported codecs and so on.
    //       Not every codec or image type may be parseable by this system.
    if (type.startsWith("image/")) return resizeImageBuffer;
    if (type.startsWith("video/")) return createVideoScreenshot;
    throw new TypeError("not cool!");
}

async function resizeImageBuffer(buf: Buffer, _: string): Promise<Buffer> {
    return (
        sharp(buf)
            // The height is automagically adjusted alongside!
            .resize({ width: config.width })
            .avif({ quality: config.quality })
            .toBuffer()
    );
}

function createVideoScreenshot(buf: Buffer, type: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks = new Array<Uint8Array>();
        const stream = bufferToStream(buf);
        const command = ffmpeg().input(stream); // does the input format have to be inputted normally?

        command
            .outputOptions([
                "-ss 00:00:00", // seeking to the first frame
                "-vframes 1", // only one frame
                `-vf "scale=${config.width}:-2"`,
                "-q:v 2" // jpg quality
            ])
            .format("mjpeg")
            .on("error", (err) => reject(err))
            .on("end", () => resolve(Buffer.concat(chunks)))
            .pipe()
            .on("data", (chunk) => chunks.push(chunk))
            .on("error", (err) => reject(err));
    });
}

function bufferToStream(buf: Buffer) {
    const stream = new Readable();
    stream.push(buf);
    stream.push(null);
    return stream;
}

const MAX_ATTEMPT_COUNT = 3;
const MAX_WAIT_TIME_SECONDS = 10;
async function fetchAttachmentLinkOrFail(message: string, channel: string, attempt: number = 0): Promise<string | null> {
    if (attempt == MAX_ATTEMPT_COUNT) {
        return null;
    }

    const response = await Discord.bot.getMessages([message], channel);
    if (!response.data) {
        logError("Failed to fetch message due to:", response.error);
        return null;
    }
    return response.data.get(message) ?? null;
}
