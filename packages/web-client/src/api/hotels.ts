import {
  authGet,
  authPatch,
  authedFetch,
} from "./core.js";

export type HotelDto = {
  readonly id: string;
  readonly name: string;
  readonly timezone: string;
  readonly currency: string;
  readonly chainId: string;
  readonly kashrutEnabled: boolean;
};

export type RoomDto = {
  readonly id: string;
  readonly number: string;
  readonly floor: string;
  readonly roomType: string;
  readonly status: "vacant" | "occupied" | "dirty" | "maintenance";
};

export type RoomPrepStatusDto =
  | "waiting"
  | "cleaning"
  | "ready"
  | "invited";

export type BookingDto = {
  readonly id: string;
  readonly roomId: string;
  readonly roomNumber: string;
  readonly guestName: string;
  readonly guestEmail: string;
  readonly guestPhone: string | null;
  readonly checkInDate: string;
  readonly checkOutDate: string;
  readonly status: "confirmed" | "checked_in" | "checked_out" | "cancelled";
  readonly roomPrepStatus: RoomPrepStatusDto | null;
};

export type HotelOverviewDto = {
  readonly id: string;
  readonly name: string;
  readonly timezone: string;
  readonly currency: string;
  readonly chainId: string;
  readonly rooms: {
    readonly total: number;
    readonly vacant: number;
    readonly occupied: number;
    readonly dirty: number;
    readonly maintenance: number;
  };
  readonly bookings: {
    readonly confirmed: number;
    readonly checkedIn: number;
    readonly active: number;
  };
};

export type ChainOverviewDto = {
  readonly tenantId: string;
  readonly tenantName: string;
  readonly hotelCount: number;
  readonly hotels: readonly HotelOverviewDto[];
};

export type GuestUpsellOfferDto = {
  readonly id: string;
  readonly offerType:
    | "room_upgrade"
    | "spa"
    | "dinner"
    | "late_checkout"
    | "other";
  readonly titleHe: string;
  readonly descriptionHe: string;
  readonly priceAmount: number;
  readonly currency: string;
  readonly status: "suggested" | "accepted" | "declined" | "expired";
  readonly suggestedAt: string;
};

export async function fetchChainOverview(): Promise<ChainOverviewDto> {
  const payload = (await authGet("/v1/overview/chain")) as {
    data: ChainOverviewDto;
  };
  return payload.data;
}

export async function listHotels(): Promise<readonly HotelDto[]> {
  const payload = (await authGet("/v1/hotels")) as { data: HotelDto[] };
  return payload.data;
}

export async function updateHotelKashrut(
  hotelId: string,
  enabled: boolean,
): Promise<HotelDto> {
  const payload = (await authPatch(`/v1/hotels/${hotelId}/kashrut`, {
    enabled,
  })) as { data: HotelDto };
  return payload.data;
}

export async function listRooms(hotelId: string): Promise<readonly RoomDto[]> {
  const payload = (await authGet(`/v1/hotels/${hotelId}/rooms`)) as {
    data: RoomDto[];
  };
  return payload.data;
}

export async function listBookings(
  hotelId: string,
): Promise<readonly BookingDto[]> {
  const payload = (await authGet(`/v1/hotels/${hotelId}/bookings`)) as {
    data: BookingDto[];
  };
  return payload.data;
}

export async function createBooking(
  hotelId: string,
  input: {
    roomId: string;
    guestName: string;
    guestEmail: string;
    checkInDate: string;
    checkOutDate: string;
    status?: "confirmed" | "checked_in";
  },
): Promise<BookingDto> {
  const { payload } = await authedFetch(`/v1/hotels/${hotelId}/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = payload as { data?: BookingDto };
  if (!body.data) {
    throw new Error("Invalid create booking response");
  }
  return body.data;
}

export type UpsellOfferDto = {
  readonly id: string;
  readonly hotelId: string;
  readonly bookingId: string | null;
  readonly guestEmail: string | null;
  readonly offerType: GuestUpsellOfferDto["offerType"];
  readonly titleHe: string;
  readonly descriptionHe: string;
  readonly priceAmount: number;
  readonly currency: string;
  readonly status: GuestUpsellOfferDto["status"];
  readonly source: "rules" | "agent.guest";
  readonly suggestedAt: string;
  readonly decidedAt: string | null;
  readonly createdAt: string;
};

export async function suggestGuestUpsells(input: {
  readonly hotelId: string;
  readonly bookingId: string;
}): Promise<readonly UpsellOfferDto[]> {
  const { payload } = await authedFetch("/v1/ops/upsells/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = payload as { data?: UpsellOfferDto[] };
  if (!Array.isArray(body.data)) {
    throw new Error("Invalid suggest upsells response");
  }
  return body.data;
}

export async function listGuestUpsells(input: {
  readonly hotelId: string;
  readonly bookingId: string;
}): Promise<readonly UpsellOfferDto[]> {
  const params = new URLSearchParams({
    hotelId: input.hotelId,
    bookingId: input.bookingId,
  });
  const { payload } = await authedFetch(`/v1/ops/upsells?${params.toString()}`);
  const body = payload as { data?: UpsellOfferDto[] };
  if (!Array.isArray(body.data)) {
    throw new Error("Invalid list upsells response");
  }
  return body.data;
}

export async function decideGuestUpsell(input: {
  readonly hotelId: string;
  readonly offerId: string;
  readonly decision: "accepted" | "declined";
}): Promise<UpsellOfferDto> {
  const params = new URLSearchParams({ hotelId: input.hotelId });
  const { payload } = await authedFetch(
    `/v1/ops/upsells/${input.offerId}/decide?${params.toString()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: input.decision }),
    },
  );
  const body = payload as { data?: UpsellOfferDto };
  if (!body.data) {
    throw new Error("Invalid decide upsell response");
  }
  return body.data;
}

export async function updateRoomStatus(
  hotelId: string,
  roomId: string,
  status: RoomDto["status"],
): Promise<RoomDto> {
  const payload = (await authPatch(
    `/v1/hotels/${hotelId}/rooms/${roomId}/status`,
    { status },
  )) as { data: RoomDto };
  return payload.data;
}

export async function updateBookingTransition(
  hotelId: string,
  bookingId: string,
  transition: "check_in" | "check_out",
): Promise<BookingDto> {
  const { payload } = await authedFetch(
    `/v1/hotels/${hotelId}/bookings/${bookingId}/status`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transition }),
    },
  );
  const body = payload as { data?: BookingDto };
  if (!body.data) {
    throw new Error("Invalid booking status response");
  }
  return body.data;
}

export type GuestNotificationDto = {
  readonly id: string;
  readonly channel: string;
  readonly eventKey: string;
  readonly toAddress: string | null;
  readonly body: string;
  readonly status: string;
  readonly error: string | null;
  readonly provider: string;
  readonly attemptCount?: number;
  readonly nextAttemptAt?: string | null;
  readonly createdAt: string;
  readonly sentAt: string | null;
};

export async function listHotelNotifications(
  hotelId: string,
): Promise<readonly GuestNotificationDto[]> {
  const payload = (await authGet(`/v1/hotels/${hotelId}/notifications`)) as {
    data: GuestNotificationDto[];
  };
  return payload.data;
}

export type BookingRoomPrepDto = BookingDto & {
  readonly notification: GuestNotificationDto | null;
};

export async function updateBookingRoomPrep(
  hotelId: string,
  bookingId: string,
  status: "waiting" | "invited",
): Promise<BookingRoomPrepDto> {
  const payload = (await authPatch(
    `/v1/hotels/${hotelId}/bookings/${bookingId}/room-prep`,
    { status },
  )) as { data?: BookingRoomPrepDto };
  if (!payload.data) {
    throw new Error("Invalid room prep response");
  }
  return payload.data;
}
