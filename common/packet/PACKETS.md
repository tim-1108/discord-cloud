# Packet sending, receiving and replying

Packets follow a standard format, as JSON records formatted like this:

```json
{
    "id": "<category>:<id>",
    "uuid": "The uuid of this packet",
    "reply_uuid": "The uuid of the packet this packet is replying to",
    "data": {
        // Must always be a record, can be empty.
        // Follows the definition of the packet structure.
    }
}
```

The packet ID is formatted in kebab case.

### Packet Categories

- `c2s`: Client to Server
- `s2c`: Server to Client
- `s2u`: Server to Uploader
- `u2s`: Uploader to Service

All services use the same packet protocol.

A service may not send a packet meant to only come from another source!
Such cases are filtered out.

## Sending a packet

A packet may be created directly using a constructor, i.e.:

```ts
const packet = new UploadStartPacket({
    /* imagine some metadata here */
});
```

When creating a packet directly to send it over the wire,
the data should be specified in the constructor.
Type annotations should be available.

Packets that have been generated using `parsePacket` are not able to be sent.
These represent packets that have been **received** and allowing them to be sent
further might cause issues down the road.

A subclass of `PacketReceiver` may call either `sendPacket`, resolving
to a Promise with either an `Error` object or `null` in case the
packet has been sent successfully, or `sendPacketAndReply`, allowing for
a reply packet type to be set.

If that packet does not arrive during the specified (or default) timeout,
that Promise resolves to `null`, otherwise to an instance of the
requested subclass of `Packet`.

When sending a packet and no `uuid` field on it is set, the `serialize` method
will automagically set one for you!

### Example

```ts
const packet = new UploadStartPacket({
    /* some other metadata here */
});
const reply = await this.sendPacketAndReply(packet, UploadStartConfirmPacket);
// Resolves to either null or an instance of UploadStartConfirmPacket (with data set)
```

## Replying to a packet

If a received packet specifies a `uuid` field, a packet sent
may specify a `reply_uuid` field of the same UUID.
No additional information is required to reply to another packet.

A manager, service or client may or may not await replies from its connection
partner. However, these reply Promises will time out after some time,
indicating that the originator is no longer waiting for a response.
This is not communicated to the original target.

A target, unless explicitly communicated via another packet,
will not know whether their reply packet has been accepted.

### Example

#### Original packet, server to uploader

```json
{
    "id": "s2u:upload-start",
    "uuid": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "reply_uuid": undefined, // thus not set
    "data": {
        // think of some metadata
    }
}
```

#### Reply packet, uploader to server

```json
{
    "id": "u2s:upload-start-confirm",
    "uuid": "11111111-2222-3333-4444-555555555555",
    "reply_uuid": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "data": {
        "accepted": false
    }
}
```

## Registering a new packet

A new packet should inherit a subclass of `Packet`, so i.e. `S2CPacket` or `S2UPacket`.

**DO NOT** directly extend `Packet`, as the `id` field will be set incorrectly.

Remember to give packets unique IDs to prevent conflicts.

Packet classes should include specific fields to ease development and provide type definitions.

### Example

```ts
// Only update this variable when changing packet id.
// The prefix (c2s:) will automatically be concattinated by its super class
const id = "upload-queue-add";

type DataType = SchemaToType<typeof dataStructure>;
// The data structure follows SchemaEntryConsumer
const dataStructure = {
    name: { type: "string", required: true, pattern: patterns.fileName },
    path: { type: "string", required: true, pattern: patterns.stringifiedPath },
    size: { type: "number", required: true, min: 0 }
} as const;

export class UploadQueueAddPacket extends C2SPacket {
    declare protected data: DataType;
    public static readonly ID = id;

    public getDataStructure() {
        return dataStructure;
    }

    public getData() {
        return this.data;
    }

    public constructor(data?: DataType) {
        super(id, data);
    }
}
```
