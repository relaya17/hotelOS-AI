import type { PmsConnector, PmsHotelInventory } from "../types.js";

/**
 * Mews-shaped stub — no network / no API keys.
 * Distinct sample inventory from demo.pms so Twin UI can prove provider switch.
 */
export function createMewsStubPmsConnector(): PmsConnector {
  return {
    providerId: "mews.stub",
    fetchInventory(externalHotelId) {
      const fetchedAt = new Date().toISOString();
      const day = fetchedAt.slice(0, 10);
      const tomorrow = new Date(`${day}T12:00:00.000Z`);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const inventory: PmsHotelInventory = {
        providerId: "mews.stub",
        externalHotelId,
        fetchedAt,
        rooms: [
          {
            externalRoomId: `mews-${externalHotelId}-R101`,
            roomNumber: "101",
            status: "vacant",
            floor: "1",
          },
          {
            externalRoomId: `mews-${externalHotelId}-R103`,
            roomNumber: "103",
            status: "occupied",
            floor: "1",
          },
          {
            externalRoomId: `mews-${externalHotelId}-R301`,
            roomNumber: "301",
            status: "dirty",
            floor: "3",
          },
        ],
        reservations: [
          {
            externalReservationId: `mews-${externalHotelId}-RES-9`,
            guestName: "Mews Stub Guest",
            roomNumber: "103",
            checkInDate: day,
            checkOutDate: tomorrow.toISOString().slice(0, 10),
            status: "confirmed",
          },
        ],
      };
      return Promise.resolve(inventory);
    },
  };
}
