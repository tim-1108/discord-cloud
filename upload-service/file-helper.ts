/**
 * The size the client should send to this service and
 * accordingly the size the Webhook uploads to Discord.
 */
const CHUNK_SIZE = 24 * 1024 * 1024;

/**
 * Generates the desired sizes for all chunks the user should upload.
 *
 * The size the user provides has to match the desired size EXACTLY!
 * @param totalSize The size provided by the socket packet {@link UploadStartPacket}
 */
export function generateChunkSizes(totalSize: number) {
    if (totalSize <= CHUNK_SIZE) return [totalSize];
    let remainingSize = totalSize;
    const chunks = new Array<number>();
    do {
        chunks.push(CHUNK_SIZE);
    } while ((remainingSize -= CHUNK_SIZE) > CHUNK_SIZE);
    if (remainingSize > 0) chunks.push(remainingSize);
    return chunks;
}
