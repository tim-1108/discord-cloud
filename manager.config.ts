export default {
    supabase: {
        useThumbnails: true,
        /**
         * The amount of bytes a thumbnail image may be at most. If the generated
         * thumbnail exceeds this size, the image is rejected.
         *
         * For now, size, quality and type are determined within the service,
         * but that will also be moved to the manager.
         *
         * The max size defined on the Supabase bucket is also used (if defined),
         * but the minimum of both values is chosen to determine whether the file
         * may be uploaded.
         */
        maxThumbnailSize: 4 * 1024
    },
    pinging: {
        enabled: true,
        services: [] as string[]
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
    }
} as const;
