import { clearSession, readAccessToken } from "./session.js";

const API_BASE = "http://localhost:3001";

export type LoginResponse = {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly displayName: string;
    readonly roles: readonly string[];
    readonly scope: {
      readonly tenantId: string;
      readonly hotelId?: string;
    };
  };
};

export type HotelDto = {
  readonly id: string;
  readonly name: string;
  readonly timezone: string;
  readonly currency: string;
  readonly chainId: string;
};

export type RoomDto = {
  readonly id: string;
  readonly number: string;
  readonly floor: string;
  readonly roomType: string;
  readonly status: "vacant" | "occupied" | "dirty" | "maintenance";
};

export type BookingDto = {
  readonly id: string;
  readonly roomId: string;
  readonly roomNumber: string;
  readonly guestName: string;
  readonly guestEmail: string;
  readonly checkInDate: string;
  readonly checkOutDate: string;
  readonly status: "confirmed" | "checked_in" | "checked_out" | "cancelled";
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

export type GuestStayDto = {
  readonly bookingId: string;
  readonly hotelId: string;
  readonly hotelName: string;
  readonly roomNumber: string;
  readonly guestName: string;
  readonly checkInDate: string;
  readonly checkOutDate: string;
  readonly status: string;
};

type ApiError = {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
};

async function parseJson(response: Response): Promise<unknown> {
  return response.json();
}

function toErrorMessage(payload: unknown, fallback: string): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof (payload as ApiError).error?.message === "string"
  ) {
    return (payload as ApiError).error.message;
  }
  return fallback;
}

async function authGet(path: string): Promise<unknown> {
  const token = readAccessToken();
  if (!token) {
    throw new Error("Missing session");
  }
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await parseJson(response);
  if (response.status === 401) {
    clearSession();
    throw new Error("Session expired");
  }
  if (!response.ok) {
    throw new Error(toErrorMessage(payload, "Request failed"));
  }
  return payload;
}

export async function login(input: {
  tenantId: string;
  email: string;
  password: string;
}): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(toErrorMessage(payload, "Login failed"));
  }
  return payload as LoginResponse;
}

export async function fetchMe(): Promise<LoginResponse["user"]> {
  return (await authGet("/v1/auth/me")) as LoginResponse["user"];
}

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
  const token = readAccessToken();
  if (!token) {
    throw new Error("Missing session");
  }
  const response = await fetch(`${API_BASE}/v1/hotels/${hotelId}/bookings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const payload = await parseJson(response);
  if (response.status === 401) {
    clearSession();
    throw new Error("Session expired");
  }
  if (!response.ok) {
    throw new Error(toErrorMessage(payload, "Failed to create booking"));
  }
  const body = payload as { data?: BookingDto };
  if (!body.data) {
    throw new Error("Invalid create booking response");
  }
  return body.data;
}

export async function lookupGuestStay(email: string): Promise<readonly GuestStayDto[]> {
  const response = await fetch(`${API_BASE}/v1/public/stays/lookup`, {
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

export const APP_URLS = {
  executive: "http://localhost:5173",
  admin: "http://localhost:5174",
  guest: "http://localhost:5175",
} as const;
