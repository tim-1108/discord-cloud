import { communicator } from "@/main";
import { convertRouteToPath, useCurrentRoute } from "./path";
import { ListRequestPacket } from "../../../common/packet/c2s/ListRequestPacket";
import { ListPacket } from "../../../common/packet/s2c/ListPacket";
import { ref } from "vue";
import type { PartialDatabaseFileRow, PartialDatabaseFolderRow } from "../../../manager/database/core";

const listing = ref<{ files: PartialDatabaseFileRow[]; folders: PartialDatabaseFolderRow[] } | null>(null);
export function useCurrentListing() {
    return listing;
}

export async function updateListingForCurrentDirectory(): Promise<void> {
    listing.value = null;
    // TODO: (maybe) rework this function to instead return the data and have the callee write that into something
    const route = useCurrentRoute();
    const path = convertRouteToPath(route.value);
    // TODO: implement caching (client-side)
    const reply = await communicator.sendPacketAndReply(new ListRequestPacket({ path }), ListPacket);
    if (!reply) {
        listing.value = null;
        // TODO: notify user if this fails
        return;
    }
    console.log(reply);
    const { files, folders } = reply.getData();
    // The validator functions inside the ListPacket class assure us that these types are correct
    listing.value = { files: files as PartialDatabaseFileRow[], folders: folders as PartialDatabaseFolderRow[] };
}
