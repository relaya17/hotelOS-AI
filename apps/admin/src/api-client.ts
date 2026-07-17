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
