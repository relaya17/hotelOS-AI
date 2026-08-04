import {
  authGet,
  getApiBase,
  parseJson,
  toErrorMessage,
} from "./core.js";
import type { GuestUpsellOfferDto, RoomPrepStatusDto } from "./hotels.js";

export type GuestStayDto = {
  readonly bookingId: string;
  readonly hotelId: string;
  readonly hotelName: string;
  readonly roomNumber: string;
  readonly guestName: string;
  readonly guestPhone: string | null;
  readonly checkInDate: string;
  readonly checkOutDate: string;
  readonly status: string;
  readonly roomPrepStatus: RoomPrepStatusDto | null;
  readonly roomStatus: string;
  readonly upsellOffers?: readonly GuestUpsellOfferDto[];
};

export type GuestFolioDto = {
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

export type Guest360ProfileDto = {
  readonly email: string;
  readonly displayName: string;
  readonly phone: string | null;
  readonly notesHe: string | null;
  readonly preferences: Record<string, unknown>;
  readonly stayCount: number;
  readonly lastStayAt: string | null;
  readonly marketingConsent: boolean;
};

export type Guest360StayDto = {
  readonly id: string;
  readonly hotelId: string;
  readonly hotelName: string;
  readonly roomNumber: string;
  readonly guestName: string;
  readonly checkInDate: string;
  readonly checkOutDate: string;
  readonly status: string;
};

export type Guest360FeedbackDto = {
  readonly id: string;
  readonly rating: number;
  readonly comment: string | null;
  readonly categories: readonly string[];
  readonly submittedAt: string;
  readonly source: string;
};

export type Guest360ReviewDto = {
  readonly id: string;
  readonly source: string;
  readonly rating: number;
  readonly title: string | null;
  readonly body: string;
  readonly sentiment: string;
  readonly reviewedAt: string;
};

export type Guest360Dto = {
  readonly email: string;
  readonly hotelId: string;
  readonly profile: Guest360ProfileDto | null;
  readonly staysAtHotel: readonly Guest360StayDto[];
  readonly staysInChain: readonly Guest360StayDto[];
  readonly chainStayCount: number;
  readonly lastFeedback: Guest360FeedbackDto | null;
  readonly feedbackHistory: readonly Guest360FeedbackDto[];
  readonly reputationSignals: readonly Guest360ReviewDto[];
};

export async function fetchGuest360(input: {
  readonly hotelId: string;
  readonly email: string;
}): Promise<Guest360Dto> {
  const params = new URLSearchParams({
    hotelId: input.hotelId,
    email: input.email.trim(),
  });
  const payload = (await authGet(`/v1/guests/by-email?${params.toString()}`)) as {
    data: Guest360Dto;
  };
  return payload.data;
}

export async function decidePublicGuestUpsell(input: {
  readonly email: string;
  readonly bookingId: string;
  readonly offerId: string;
  readonly decision: "accepted" | "declined";
}): Promise<GuestUpsellOfferDto> {
  const response = await fetch(
    `${getApiBase()}/v1/public/stays/upsells/${input.offerId}/decide`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: input.email,
        bookingId: input.bookingId,
        decision: input.decision,
      }),
    },
  );
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(toErrorMessage(payload, "Upsell decision failed"));
  }
  const body = payload as { data?: GuestUpsellOfferDto };
  if (!body.data) {
    throw new Error("Invalid public upsell decision response");
  }
  return body.data;
}

export async function lookupGuestStay(email: string): Promise<readonly GuestStayDto[]> {
  const response = await fetch(`${getApiBase()}/v1/public/stays/lookup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(toErrorMessage(payload, "Lookup failed"));
  }
  const body = payload as { data?: GuestStayDto[] };
  if (!Array.isArray(body.data)) {
    throw new Error("Invalid lookup response");
  }
  return body.data;
}

export async function fetchGuestFolio(input: {
  readonly email: string;
  readonly bookingId: string;
}): Promise<GuestFolioDto> {
  const response = await fetch(`${getApiBase()}/v1/public/stays/folio`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(toErrorMessage(payload, "Folio request failed"));
  }
  const body = payload as { data?: GuestFolioDto };
  if (!body.data || !Array.isArray(body.data.lines)) {
    throw new Error("Invalid folio response");
  }
  return body.data;
}

export async function checkInGuestStay(input: {
  readonly email: string;
  readonly bookingId: string;
}): Promise<GuestStayDto> {
  const response = await fetch(`${getApiBase()}/v1/public/stays/check-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(toErrorMessage(payload, "Check-in failed"));
  }
  const body = payload as { data?: GuestStayDto };
  if (!body.data) {
    throw new Error("Invalid check-in response");
  }
  return body.data;
}

export async function checkOutGuestStay(input: {
  readonly email: string;
  readonly bookingId: string;
}): Promise<GuestStayDto> {
  const response = await fetch(`${getApiBase()}/v1/public/stays/check-out`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(toErrorMessage(payload, "Check-out failed"));
  }
  const body = payload as { data?: GuestStayDto };
  if (!body.data) {
    throw new Error("Invalid check-out response");
  }
  return body.data;
}
