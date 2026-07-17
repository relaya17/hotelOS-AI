const ACCESS_KEY = "hotelos.accessToken";
const REFRESH_KEY = "hotelos.refreshToken";
const USER_KEY = "hotelos.user";

export type StoredUser = {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly roles: readonly string[];
  readonly tenantId: string;
  readonly hotelId?: string;
};

export function saveSession(input: {
  accessToken: string;
  refreshToken: string;
  user: StoredUser;
}): void {
  sessionStorage.setItem(ACCESS_KEY, input.accessToken);
  sessionStorage.setItem(REFRESH_KEY, input.refreshToken);
  sessionStorage.setItem(USER_KEY, JSON.stringify(input.user));
}

export function clearSession(): void {
  sessionStorage.removeItem(ACCESS_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function readAccessToken(): string | null {
  return sessionStorage.getItem(ACCESS_KEY);
}

export function readRefreshToken(): string | null {
  return sessionStorage.getItem(REFRESH_KEY);
}

export function updateTokens(input: {
  accessToken: string;
  refreshToken: string;
}): void {
  sessionStorage.setItem(ACCESS_KEY, input.accessToken);
  sessionStorage.setItem(REFRESH_KEY, input.refreshToken);
}

export function readStoredUser(): StoredUser | null {
  const raw = sessionStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("id" in parsed) ||
      !("email" in parsed) ||
      !("displayName" in parsed) ||
      !("roles" in parsed) ||
      !("tenantId" in parsed)
    ) {
      return null;
    }
    const record = parsed as {
      id: unknown;
      email: unknown;
      displayName: unknown;
      roles: unknown;
      tenantId: unknown;
      hotelId?: unknown;
    };
    if (
      typeof record.id !== "string" ||
      typeof record.email !== "string" ||
      typeof record.displayName !== "string" ||
      typeof record.tenantId !== "string" ||
      !Array.isArray(record.roles) ||
      !record.roles.every((role) => typeof role === "string")
    ) {
      return null;
    }
    return {
      id: record.id,
      email: record.email,
      displayName: record.displayName,
      roles: record.roles,
      tenantId: record.tenantId,
      ...(typeof record.hotelId === "string" ? { hotelId: record.hotelId } : {}),
    };
  } catch {
    return null;
  }
}
