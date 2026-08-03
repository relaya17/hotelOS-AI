import {
  BREAKFAST_RATE_PER_NIGHT,
  countNights,
  roomRateFor,
  roundMoney,
  VAT_RATE,
} from "./room-rates.js";

export type GuestFolioStay = {
  readonly checkInDate: string;
  readonly checkOutDate: string;
  readonly roomNumber: string;
  readonly roomType: string | null;
  readonly currency: string;
};

export type GuestFolio = {
  readonly status: "estimate";
  readonly checkInDate: string;
  readonly checkOutDate: string;
  readonly roomNumber: string;
  readonly roomType: string | null;
  readonly nights: number;
  readonly currency: string;
  readonly lines: readonly {
    readonly label: string;
    readonly amount: number;
  }[];
  readonly subtotal: number;
  readonly tax: number;
  readonly total: number;
  readonly paid: number;
  readonly balanceDue: number;
};

export function buildGuestFolio(stay: GuestFolioStay): GuestFolio {
  const nights = countNights(stay.checkInDate, stay.checkOutDate);
  const roomTotal = nights * roomRateFor(stay.roomType);
  const breakfastTotal = nights * BREAKFAST_RATE_PER_NIGHT;
  const subtotal = roomTotal + breakfastTotal;
  const tax = roundMoney(subtotal * VAT_RATE);
  const total = roundMoney(subtotal + tax);

  return {
    status: "estimate",
    checkInDate: stay.checkInDate,
    checkOutDate: stay.checkOutDate,
    roomNumber: stay.roomNumber,
    roomType: stay.roomType,
    nights,
    currency: stay.currency,
    lines: [
      {
        label: `לינה · חדר ${stay.roomNumber} (${nights} לילות)`,
        amount: roomTotal,
      },
      {
        label: `ארוחת בוקר (${nights} לילות)`,
        amount: breakfastTotal,
      },
    ],
    subtotal,
    tax,
    total,
    paid: 0,
    balanceDue: total,
  };
}
