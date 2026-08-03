const ROOM_RATE_PER_NIGHT: Readonly<Record<string, number>> = {
  standard: 450,
  deluxe: 550,
  suite: 700,
  sea_view: 620,
};

const DEFAULT_ROOM_RATE_PER_NIGHT = 450;
const BREAKFAST_RATE_PER_NIGHT = 85;
const VAT_RATE = 0.17;

export const ROOM_TYPE_LABELS_HE: Readonly<Record<string, string>> = {
  standard: "סטנדרט",
  deluxe: "דלוקס",
  suite: "סוויטה",
  sea_view: "נוף לים",
};

export function countNights(checkInDate: string, checkOutDate: string): number {
  const checkIn = new Date(`${checkInDate}T12:00:00Z`);
  const checkOut = new Date(`${checkOutDate}T12:00:00Z`);
  const nights = Math.round(
    (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24),
  );
  return Math.max(nights, 1);
}

export function roomRateFor(roomType: string | null): number {
  if (!roomType) return DEFAULT_ROOM_RATE_PER_NIGHT;
  return (
    ROOM_RATE_PER_NIGHT[roomType.trim().toLowerCase()] ??
    DEFAULT_ROOM_RATE_PER_NIGHT
  );
}

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function quoteRoomStay(input: {
  readonly roomType: string;
  readonly checkInDate: string;
  readonly checkOutDate: string;
  readonly currency: string;
}): {
  readonly roomType: string;
  readonly roomTypeLabelHe: string;
  readonly nights: number;
  readonly currency: string;
  readonly roomTotal: number;
  readonly breakfastTotal: number;
  readonly subtotal: number;
  readonly tax: number;
  readonly total: number;
  readonly amountMinor: number;
} {
  const nights = countNights(input.checkInDate, input.checkOutDate);
  const roomTotal = nights * roomRateFor(input.roomType);
  const breakfastTotal = nights * BREAKFAST_RATE_PER_NIGHT;
  const subtotal = roomTotal + breakfastTotal;
  const tax = roundMoney(subtotal * VAT_RATE);
  const total = roundMoney(subtotal + tax);
  const key = input.roomType.trim().toLowerCase();
  return {
    roomType: key,
    roomTypeLabelHe: ROOM_TYPE_LABELS_HE[key] ?? input.roomType,
    nights,
    currency: input.currency,
    roomTotal,
    breakfastTotal,
    subtotal,
    tax,
    total,
    amountMinor: Math.round(total * 100),
  };
}

export { BREAKFAST_RATE_PER_NIGHT, VAT_RATE };
