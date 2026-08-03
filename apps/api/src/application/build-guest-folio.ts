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

const ROOM_RATE_PER_NIGHT: Readonly<Record<string, number>> = {
  standard: 450,
  deluxe: 550,
  suite: 700,
};
const DEFAULT_ROOM_RATE_PER_NIGHT = 450;
const BREAKFAST_RATE_PER_NIGHT = 85;
const VAT_RATE = 0.17;

function countNights(checkInDate: string, checkOutDate: string): number {
  const checkIn = new Date(`${checkInDate}T12:00:00Z`);
  const checkOut = new Date(`${checkOutDate}T12:00:00Z`);
  const nights = Math.round(
    (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24),
  );
  return Math.max(nights, 1);
}

function roomRateFor(roomType: string | null): number {
  if (!roomType) return DEFAULT_ROOM_RATE_PER_NIGHT;
  return ROOM_RATE_PER_NIGHT[roomType.trim().toLowerCase()] ??
    DEFAULT_ROOM_RATE_PER_NIGHT;
}

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

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
