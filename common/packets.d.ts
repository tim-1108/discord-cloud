export interface PacketStructure extends UnknownPacketStructure {
	id: string;
	data: Record<string, any>;
}
export interface UnknownPacketStructure {
	id: any;
	data: any;
}
