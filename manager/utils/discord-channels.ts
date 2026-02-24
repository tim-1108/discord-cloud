import managerConfig from "../../manager.config";
const channels = managerConfig.discord.channelIds;
const bookings = new Array<number>(channels.length);

export const DiscordChannelBooking = {
    book,
    free
} as const;

function book(): { index: number; channelId: string } | null {
    if (channels.length !== bookings.length) {
        throw new Error("Channels and bookings have different lengths");
    }

    for (let i = 0; i < channels.length; i++) {
        const value = bookings[i];
        // The value may also be undefined, but undefined is not greater than 1
        if (value >= 1) continue;
        bookings[i] = 1;
        return { index: i, channelId: channels[i] };
    }

    // At this point, all channels are already at least once in use
    if (!managerConfig.discord.allowMultipleAssignments) {
        return null;
    }
    // predictable, but not critical
    const index = Math.floor(Math.random() * channels.length);
    return { index, channelId: channels[index] };
}

function free(index: number): void {
    const value = bookings[index];
    if (value >= 1) {
        bookings[index]--;
    }
}
