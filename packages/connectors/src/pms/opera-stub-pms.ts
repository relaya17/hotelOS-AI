import type { PmsConnector, PmsHotelInventory } from "../types.js";

/**
 * Opera-shaped stub — no network / no API keys.
 * Distinct sample inventory from demo.pms / mews.stub so Twin UI can prove provider switch.
 */
export function createOperaStubPmsConnector(): PmsConnector {
  return {
    providerId: "opera.stub",
    fetchInventory(externalHotelId) {
      const fetchedAt = new Date().toISOString();
      const day = fetchedAt.slice(0, 10);
      const checkout = new Date(`${day}T12:00:00.000Z`);
      checkout.setUTCDate(checkout.getUTCDate() + 3);
      const inventory: PmsHotelInventory = {
        providerId: "opera.stub",
        externalHotelId,
        fetchedAt,
        rooms: [
          {
            externalRoomId: `opera-${externalHotelId}-R205`,
            roomNumber: "205",
            status: "occupied",
            floor: "2",
          },
          {
            externalRoomId: `opera-${externalHotelId}-R207`,
            roomNumber: "207",
            status: "vacant",
            floor: "2",
          },
          {
            externalRoomId: `opera-${externalHotelId}-R410`,
            roomNumber: "410",
            status: "maintenance",
            floor: "4",
          },
        ],
        reservations: [
          {
            externalReservationId: `opera-${externalHotelId}-RES-42`,
            guestName: "Opera Stub Guest",
            roomNumber: "205",
            checkInDate: day,
            checkOutDate: checkout.toISOString().slice(0, 10),
            status: "in_house",
          },
          {
            externalReservationId: `opera-${externalHotelId}-RES-43`,
            guestName: "Opera Arrival",
            roomNumber: "207",
            checkInDate: checkout.toISOString().slice(0, 10),
            checkOutDate: new Date(checkout.getTime() + 86400000 * 2)
              .toISOString()
              .slice(0, 10),
            status: "confirmed",
          },
        ],
      };
      return Promise.resolve(inventory);
    },
  };
}
