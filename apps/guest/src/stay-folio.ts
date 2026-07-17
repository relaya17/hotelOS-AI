import type { GuestStayDto } from "@hotelos/web-client";

export type FolioLine = {
  readonly label: string;
  readonly amount: number;
};

export type EstimatedFolio = {
  readonly nights: number;
  readonly currency: string;
  readonly lines: readonly FolioLine[];
  readonly total: number;
};

const ROOM_RATE_PER_NIGHT = 450;
const BREAKFAST_RATE_PER_NIGHT = 85;

function countNights(checkInDate: string, checkOutDate: string): number {
  const checkIn = new Date(`${checkInDate}T12:00:00`);
  const checkOut = new Date(`${checkOutDate}T12:00:00`);
  const diffMs = checkOut.getTime() - checkIn.getTime();
  const nights = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(nights, 1);
}

export function estimateFolio(stay: GuestStayDto): EstimatedFolio {
  const nights = countNights(stay.checkInDate, stay.checkOutDate);
  const roomTotal = nights * ROOM_RATE_PER_NIGHT;
  const breakfastTotal = nights * BREAKFAST_RATE_PER_NIGHT;

  const lines: readonly FolioLine[] = [
    {
      label: `לינה · חדר ${stay.roomNumber} (${nights} לילות)`,
      amount: roomTotal,
    },
    {
      label: `ארוחת בוקר (${nights} לילות)`,
      amount: breakfastTotal,
    },
  ];

  return {
    nights,
    currency: "₪",
    lines,
    total: roomTotal + breakfastTotal,
  };
}

export function formatCurrency(amount: number, currency: string): string {
  return `${currency}${amount.toLocaleString("he-IL")}`;
}
