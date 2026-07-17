import { brandId, type Brand } from "./branded.js";

export type TenantId = Brand<string, "TenantId">;
export type ChainId = Brand<string, "ChainId">;
export type HotelId = Brand<string, "HotelId">;
export type DepartmentId = Brand<string, "DepartmentId">;
export type RoomId = Brand<string, "RoomId">;
export type BookingId = Brand<string, "BookingId">;
export type UserId = Brand<string, "UserId">;
export type CorrelationId = Brand<string, "CorrelationId">;
export type AgentId = Brand<string, "AgentId">;
export type BriefingRoomId = Brand<string, "BriefingRoomId">;

export const Ids = {
  tenant: (value: string): TenantId => brandId<"TenantId">(value),
  chain: (value: string): ChainId => brandId<"ChainId">(value),
  hotel: (value: string): HotelId => brandId<"HotelId">(value),
  department: (value: string): DepartmentId => brandId<"DepartmentId">(value),
  room: (value: string): RoomId => brandId<"RoomId">(value),
  booking: (value: string): BookingId => brandId<"BookingId">(value),
  user: (value: string): UserId => brandId<"UserId">(value),
  correlation: (value: string): CorrelationId => brandId<"CorrelationId">(value),
  agent: (value: string): AgentId => brandId<"AgentId">(value),
  briefingRoom: (value: string): BriefingRoomId =>
    brandId<"BriefingRoomId">(value),
} as const;
