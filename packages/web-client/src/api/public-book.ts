import { getApiBase, parseJson, toErrorMessage } from "./core.js";

export type PublicHotelDto = {
  readonly id: string;
  readonly name: string;
  readonly timezone: string;
  readonly currency: string;
  readonly kashrutEnabled: boolean;
};

export type PublicAvailabilityOfferDto = {
  readonly roomType: string;
  readonly labelHe: string;
  readonly availableCount: number;
  readonly ratePerNight: number;
};

export type PublicAvailabilityDto = {
  readonly hotelId: string;
  readonly hotelName: string;
  readonly currency: string;
  readonly checkInDate: string;
  readonly checkOutDate: string;
  readonly offers: readonly PublicAvailabilityOfferDto[];
};

export type PublicQuoteDto = {
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
};

export type PublicBookingResultDto = {
  readonly bookingId: string;
  readonly hotelId: string;
  readonly roomNumber: string;
  readonly guestName: string;
  readonly guestEmail: string;
  readonly checkInDate: string;
  readonly checkOutDate: string;
  readonly status: string;
  readonly quote: PublicQuoteDto;
  readonly payment: {
    readonly id: string;
    readonly status: string;
    readonly amountMinor: number;
    readonly currency: string;
  };
};

export async function listPublicHotels(): Promise<readonly PublicHotelDto[]> {
  const response = await fetch(`${getApiBase()}/v1/public/hotels`);
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(toErrorMessage(payload, "Failed to load hotels"));
  }
  const body = payload as { data?: PublicHotelDto[] };
  if (!Array.isArray(body.data)) {
    throw new Error("Invalid hotels response");
  }
  return body.data;
}

export async function fetchPublicAvailability(input: {
  readonly hotelId: string;
  readonly checkInDate: string;
  readonly checkOutDate: string;
}): Promise<PublicAvailabilityDto> {
  const params = new URLSearchParams({
    checkIn: input.checkInDate,
    checkOut: input.checkOutDate,
  });
  const response = await fetch(
    `${getApiBase()}/v1/public/hotels/${encodeURIComponent(input.hotelId)}/availability?${params}`,
  );
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(toErrorMessage(payload, "Availability failed"));
  }
  const body = payload as { data?: PublicAvailabilityDto };
  if (!body.data) {
    throw new Error("Invalid availability response");
  }
  return body.data;
}

export async function createPublicBooking(input: {
  readonly hotelId: string;
  readonly roomType: string;
  readonly guestName: string;
  readonly guestEmail: string;
  readonly guestPhone?: string;
  readonly checkInDate: string;
  readonly checkOutDate: string;
}): Promise<PublicBookingResultDto> {
  const response = await fetch(
    `${getApiBase()}/v1/public/hotels/${encodeURIComponent(input.hotelId)}/bookings`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomType: input.roomType,
        guestName: input.guestName,
        guestEmail: input.guestEmail,
        ...(input.guestPhone !== undefined
          ? { guestPhone: input.guestPhone }
          : {}),
        checkInDate: input.checkInDate,
        checkOutDate: input.checkOutDate,
      }),
    },
  );
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(toErrorMessage(payload, "Booking failed"));
  }
  const body = payload as { data?: PublicBookingResultDto };
  if (!body.data) {
    throw new Error("Invalid booking response");
  }
  return body.data;
}

export type PublicBookDraftDto = {
  readonly hotelId?: string;
  readonly checkInDate?: string;
  readonly checkOutDate?: string;
  readonly roomType?: string;
  readonly guestName?: string;
  readonly guestEmail?: string;
  readonly guestPhone?: string;
};

export type PublicBookAssistantResultDto = {
  readonly replyHe: string;
  readonly draft: PublicBookDraftDto;
  readonly missing: readonly string[];
  readonly readyToConfirm: boolean;
  readonly offers: readonly {
    readonly roomType: string;
    readonly labelHe: string;
    readonly availableCount: number;
    readonly total: number;
    readonly currency: string;
  }[];
  readonly booked?: {
    readonly bookingId: string;
    readonly guestEmail: string;
    readonly hotelName: string;
    readonly checkInDate: string;
    readonly checkOutDate: string;
    readonly roomType: string;
    readonly total: number;
    readonly currency: string;
  };
};

export async function postPublicWhatsAppInbound(input: {
  readonly from: string;
  readonly body: string;
  readonly hotelId?: string;
}): Promise<{
  readonly intent: string;
  readonly replyHe: string;
  readonly booked?: { readonly bookingId: string; readonly guestEmail: string };
}> {
  const response = await fetch(`${getApiBase()}/v1/public/whatsapp/inbound`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      from: input.from,
      body: input.body,
      ...(input.hotelId !== undefined ? { hotelId: input.hotelId } : {}),
    }),
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(toErrorMessage(payload, "WhatsApp inbound failed"));
  }
  const body = payload as {
    data?: {
      intent: string;
      replyHe: string;
      booked?: { bookingId: string; guestEmail: string };
    };
  };
  if (!body.data) throw new Error("Invalid WhatsApp inbound response");
  return body.data;
}

export async function invokePublicBookAssistant(input: {
  readonly message: string;
  readonly confirm?: boolean;
  readonly draft?: PublicBookDraftDto;
}): Promise<PublicBookAssistantResultDto> {
  const response = await fetch(`${getApiBase()}/v1/public/book-assistant`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: input.message,
      ...(input.confirm !== undefined ? { confirm: input.confirm } : {}),
      ...(input.draft !== undefined ? { draft: input.draft } : {}),
    }),
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(toErrorMessage(payload, "Book assistant failed"));
  }
  const body = payload as { data?: PublicBookAssistantResultDto };
  if (!body.data) {
    throw new Error("Invalid book assistant response");
  }
  return body.data;
}
