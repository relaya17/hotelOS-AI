/** Canonical PMS inventory DTOs — connectors map vendor payloads into these. */

export type PmsRoomStatus =
  | "vacant"
  | "occupied"
  | "dirty"
  | "maintenance"
  | "unknown";

export type PmsRoomSnapshot = {
  readonly externalRoomId: string;
  readonly roomNumber: string;
  readonly status: PmsRoomStatus;
  readonly floor?: string;
};

export type PmsReservationSnapshot = {
  readonly externalReservationId: string;
  readonly guestName: string;
  readonly roomNumber: string | null;
  readonly checkInDate: string;
  readonly checkOutDate: string;
  readonly status: "confirmed" | "in_house" | "checked_out" | "cancelled";
};

export type PmsHotelInventory = {
  readonly providerId: string;
  readonly externalHotelId: string;
  readonly fetchedAt: string;
  readonly rooms: readonly PmsRoomSnapshot[];
  readonly reservations: readonly PmsReservationSnapshot[];
};

export type PmsConnector = {
  readonly providerId: string;
  fetchInventory(externalHotelId: string): Promise<PmsHotelInventory>;
};
