/**
 * This has to be within its own seperate file.
 * When using the `import` statement, weird shenanigans happen.
 * As socket handlers in this codebase check for the packets they
 * received, they have to import packet classes. Those have parent
 * classes, like `S2CPacket`.
 * These files however also import `PacketType`.
 *
 * If `PacketType` were in `definitions.ts`, the `Enum2Class` variable
 * would be loaded before a class like `S2CPacket` could have been loaded
 * (as it requires something from `definitions.ts` to work).
 * In conclusion, this enum cannot be stored with any other packet related
 * variables in a file.
 */
enum PacketType {
    Client2Server = "c2s",
    Server2Client = "s2c",
    Server2Uploader = "s2u",
    Uploader2Server = "u2s",
    Server2Thumbnail = "s2t",
    Thumbnail2Server = "t2s",
    Generic = "generic"
}

export default PacketType;
