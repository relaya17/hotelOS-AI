import { clearSession, readAccessToken } from "./session.js";

const API_BASE = import.meta.env["VITE_API_BASE"] ?? "http://localhost:3001";

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

export async function login(input: {
  tenantId: string;
  email: string;
  password: string;
}): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE}/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(toErrorMessage(payload, "Login failed"));
  }
  return payload as LoginResponse;
}

export async function fetchMe(): Promise<LoginResponse["user"]> {
  const token = readAccessToken();
  if (!token) {
    throw new Error("Missing session");
  }

  const response = await fetch(`${API_BASE}/v1/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await parseJson(response);
  if (response.status === 401) {
    clearSession();
    throw new Error("Session expired");
  }
  if (!response.ok) {
    throw new Error(toErrorMessage(payload, "Failed to load profile"));
  }
  return payload as LoginResponse["user"];
}

export async function listHotels(): Promise<readonly HotelDto[]> {
  const token = readAccessToken();
  if (!token) {
    throw new Error("Missing session");
  }

  const response = await fetch(`${API_BASE}/v1/hotels`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await parseJson(response);
  if (response.status === 401) {
    clearSession();
    throw new Error("Session expired");
  }
  if (!response.ok) {
    throw new Error(toErrorMessage(payload, "Failed to load hotels"));
  }

  const body = payload as { data?: unknown };
  if (!Array.isArray(body.data)) {
    throw new Error("Invalid hotels response");
  }
  return body.data as HotelDto[];
}

export async function listRooms(hotelId: string): Promise<readonly RoomDto[]> {
  const token = readAccessToken();
  if (!token) {
    throw new Error("Missing session");
  }

  const response = await fetch(`${API_BASE}/v1/hotels/${hotelId}/rooms`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await parseJson(response);
  if (response.status === 401) {
    clearSession();
    throw new Error("Session expired");
  }
  if (!response.ok) {
    throw new Error(toErrorMessage(payload, "Failed to load rooms"));
  }

  const body = payload as { data?: unknown };
  if (!Array.isArray(body.data)) {
    throw new Error("Invalid rooms response");
  }
  return body.data as RoomDto[];
}

export async function listBookings(
  hotelId: string,
): Promise<readonly BookingDto[]> {
  const token = readAccessToken();
  if (!token) {
    throw new Error("Missing session");
  }

  const response = await fetch(`${API_BASE}/v1/hotels/${hotelId}/bookings`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await parseJson(response);
  if (response.status === 401) {
    clearSession();
    throw new Error("Session expired");
  }
  if (!response.ok) {
    throw new Error(toErrorMessage(payload, "Failed to load bookings"));
  }

  const body = payload as { data?: unknown };
  if (!Array.isArray(body.data)) {
    throw new Error("Invalid bookings response");
  }
  return body.data as BookingDto[];
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
