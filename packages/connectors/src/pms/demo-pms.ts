import type { PmsConnector, PmsHotelInventory } from "../types.js";

/**
 * Deterministic demo PMS — no network. Used for Twin MVP and connector wiring
 * until a real Opera/Mews/etc. adapter is approved.
 */
export function createDemoPmsConnector(): PmsConnector {
  return {
    providerId: "demo.pms",
    async fetchInventory(externalHotelId) {
      const fetchedAt = new Date().toISOString();
      const inventory: PmsHotelInventory = {
        providerId: "demo.pms",
        externalHotelId,
        fetchedAt,
        rooms: [
          {
            externalRoomId: `${externalHotelId}-101`,
            roomNumber: "101",
            status: "occupied",
            floor: "1",
          },
          {
            externalRoomId: `${externalHotelId}-102`,
            roomNumber: "102",
            status: "dirty",
            floor: "1",
          },
          {
            externalRoomId: `${externalHotelId}-201`,
            roomNumber: "201",
            status: "vacant",
            floor: "2",
          },
          {
            externalRoomId: `${externalHotelId}-202`,
            roomNumber: "202",
            status: "maintenance",
            floor: "2",
          },
        ],
        reservations: [
          {
            externalReservationId: `${externalHotelId}-R1`,
            guestName: "Demo Guest",
            roomNumber: "101",
            checkInDate: fetchedAt.slice(0, 10),
            checkOutDate: new Date(Date.now() + 86400000 * 2)
              .toISOString()
              .slice(0, 10),
            status: "in_house",
          },
        ],
      };
      return inventory;
    },
  };
}
