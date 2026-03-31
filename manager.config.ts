export const ThumbnailImageTypes = ["avif", "jpeg", "webp"] as const;

export default {
    pinging: {
        enabled: true,
        services: [] as string[]
    },
    socket: {
        /**
         * The port where the HTTP server for the authentication api and the websocket is exposed.
         */
        port: 4000
    },
    webdav: {
        enabled: true,
        /**
         * The port where the HTTP server for webdav should be exposed. If `enabled` is `false`,
         * this server is never exposed.
         */
        port: 4001,
        realmName: "discord-cloud"
    },
    discord: {
        /**
         * If `true`, all messages will be individually encrypted with the `MESSAGE_ENCRYPTION_KEY`
         * supplied via the environment variables using AES-256 GCM. This variable should be
         * a raw 32 byte buffer encoded in base 64.
         */
        useEncryption: true,
        /**
         * An array of Discord channel ids that the bot of the specified token has access to.
         * These channel ids are randomly distributed to upload services upon their connection
         * to the manager. If a id is already in use, it cannot be assigned to another service
         * unless all are used and `allowMultipleAssignments` is true.
         */
        channelIds: [] as string[],
        /**
         * If `false`, a connecting service will be refused if all channel ids have already
         * been used up. If `true`, another channel already used will be assigned. A warning
         * will be displayed as, to avoid rate limits, a bot should not write to one channel
         * too often.
         */
        allowMultipleAssignments: false
    },
    thumbnails: {
        enabled: false,
        /**
         * The width in pixels. The height is automagically adjusted to preserve the aspect
         * ratio.
         *
         * When updating this value, no existing thumbnails will be recreated.
         */
        width: 100,
        /**
         * A percentage point value of quality the image should have. Used in jpeg and avif
         * files to indicate the degree of compression, with a lower value being more lossy.
         * Integers from 0 to 100 are allowed.
         *
         * When updating this value, no existing thumbnails will be recreated.
         */
        quality: 10,
        /**
         * The amount of bytes a thumbnail image may be at most. If the generated
         * thumbnail exceeds this size, the image is rejected.
         *
         * The max size defined on the Supabase bucket is also used (if defined),
         * but the minimum of both values is chosen to determine whether the file
         * may be uploaded.
         */
        maxThumbnailSize: 4 * 1024,
        /**
         * The output format of the thumbnails. The file stored within Supabase
         * storage will have no file extension to preseve existing thumbnails
         * should this type ever be changed in this config.
         */
        image_type: "avif" as (typeof ThumbnailImageTypes)[number]
    }
} as const;
