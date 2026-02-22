import type { DataErrorFields } from "../../../common";
import { SignedDownloadRequestPacket } from "../../../common/packet/c2s/SignedDownloadRequestPacket";
import { SignedDownloadPacket } from "../../../common/packet/s2c/SignedDownloadPacket";
import { getOrCreateCommunicator, getServerAddress } from "./authentication";

export async function createSignedDownloadLink(fileId: number): Promise<DataErrorFields<URL>> {
    const com = await getOrCreateCommunicator();

    const { packet, error } = await com.sendPacketAndReply_new(new SignedDownloadRequestPacket({ file_id: fileId }), SignedDownloadPacket);
    if (!packet) {
        return { data: null, error };
    }
    const { payload } = packet.getData();
    if (!payload) {
        return { data: null, error: "The server returned an empty payload" };
    }

    const address = await getServerAddress();
    address.pathname = "/signed-download";
    address.searchParams.append("q", payload);
    return { data: address, error: null };
}
