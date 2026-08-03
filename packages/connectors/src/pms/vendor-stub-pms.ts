import type {
  PmsConnector,
  PmsHotelInventory,
  PmsRoomStatus,
} from "../types.js";

export type VendorStubSpec = {
  readonly providerId: string;
  readonly guestLabel: string;
  readonly roomPrefix: string;
  readonly rooms: readonly {
    readonly number: string;
    readonly status: PmsRoomStatus;
    readonly floor: string;
  }[];
};

/**
 * Shared stub factory for PMS vendors without live credentials.
 * Proves Digital Twin / connector switching; not a live integration.
 */
export function createVendorStubPmsConnector(
  spec: VendorStubSpec,
): PmsConnector {
  return {
    providerId: spec.providerId,
    fetchInventory(externalHotelId) {
      const fetchedAt = new Date().toISOString();
      const day = fetchedAt.slice(0, 10);
      const checkout = new Date(`${day}T12:00:00.000Z`);
      checkout.setUTCDate(checkout.getUTCDate() + 2);
      const checkoutDay = checkout.toISOString().slice(0, 10);
      const occupied = spec.rooms.find((room) => room.status === "occupied");
      const vacant = spec.rooms.find((room) => room.status === "vacant");

      const inventory: PmsHotelInventory = {
        providerId: spec.providerId,
        externalHotelId,
        fetchedAt,
        rooms: spec.rooms.map((room) => ({
          externalRoomId: `${spec.roomPrefix}-${externalHotelId}-R${room.number}`,
          roomNumber: room.number,
          status: room.status,
          floor: room.floor,
        })),
        reservations: [
          ...(occupied
            ? [
                {
                  externalReservationId: `${spec.roomPrefix}-${externalHotelId}-RES-IN`,
                  guestName: `${spec.guestLabel} In-House`,
                  roomNumber: occupied.number,
                  checkInDate: day,
                  checkOutDate: checkoutDay,
                  status: "in_house" as const,
                },
              ]
            : []),
          ...(vacant
            ? [
                {
                  externalReservationId: `${spec.roomPrefix}-${externalHotelId}-RES-ARR`,
                  guestName: `${spec.guestLabel} Arrival`,
                  roomNumber: vacant.number,
                  checkInDate: checkoutDay,
                  checkOutDate: new Date(checkout.getTime() + 86400000 * 2)
                    .toISOString()
                    .slice(0, 10),
                  status: "confirmed" as const,
                },
              ]
            : []),
        ],
      };
      return Promise.resolve(inventory);
    },
  };
}
