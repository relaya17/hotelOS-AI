import {
  clearSession,
  readAccessToken,
  readRefreshToken,
  updateTokens,
} from "../session.js";

// import.meta.env is only populated inside Vite builds (all three frontend
// apps). Falls back to the local dev API port when unset, so this keeps
// working unchanged in tests / non-Vite consumers.
const viteEnv: Record<string, string | undefined> =
  (import.meta as unknown as { env?: Record<string, string | undefined> })
    .env ?? {};

const API_STORAGE_KEY = "hotelos.apiBase";

/** Map hotel-os-ai-admin-eight.vercel.app → hotel-os-ai-api-eight.vercel.app */
function mapVercelAppRole(
  host: string,
  role: "api" | "admin" | "executive" | "guest" | "work",
): string {
  return host
    .replace(/-(admin|executive|guest|work|www|api)-/i, `-${role}-`)
    .replace(
      /-(admin|executive|guest|work|www|api)\.vercel\./i,
      `-${role}.vercel.`,
    );
}

function isLocalUrl(url: string): boolean {
  return url.includes("localhost") || url.includes("127.0.0.1");
}

/**
 * Resolve API base for the four-deploy model (3 apps + separate API).
 *
 * On Vercel: **same-origin** (`window.location.origin`) so the browser never
 * hits localhost / cross-origin. Edge `middleware.ts` proxies `/v1` + `/health`
 * to the separate API project — that is the root CORS fix.
 *
 * Locally: `VITE_API_BASE` or http://localhost:3001.
 * Optional override: `?api=https://…` → localStorage.
 */
export function getApiBase(): string {
  if (typeof window !== "undefined") {
    const fromQuery = new URLSearchParams(window.location.search).get("api");
    if (fromQuery && /^https?:\/\//i.test(fromQuery)) {
      const cleaned = fromQuery.replace(/\/$/, "");
      window.localStorage.setItem(API_STORAGE_KEY, cleaned);
      return cleaned;
    }
    const stored = window.localStorage.getItem(API_STORAGE_KEY);
    if (stored && /^https?:\/\//i.test(stored)) {
      return stored.replace(/\/$/, "");
    }
  }

  const onVercel =
    typeof window !== "undefined" &&
    (window.location.hostname.endsWith(".vercel.app") ||
      window.location.hostname.endsWith(".vercel.dev"));

  // Root fix: never call localhost from a Vercel-hosted UI.
  if (onVercel) {
    return window.location.origin;
  }

  const fromEnv = viteEnv["VITE_API_BASE"]?.replace(/\/$/, "");
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv;
  }

  return "http://localhost:3001";
}

export function describeRemoteApiMisconfig(cause?: unknown): string | undefined {
  if (typeof window === "undefined") return undefined;
  const onVercel =
    window.location.hostname.endsWith(".vercel.app") ||
    window.location.hostname.endsWith(".vercel.dev");
  if (!onVercel) return undefined;
  const msg =
    cause instanceof Error
      ? cause.message
      : typeof cause === "string"
        ? cause
        : "";
  if (!/failed to fetch|networkerror|load failed|fetch/i.test(msg)) {
    return undefined;
  }
  return (
    `אין גישה ל־API. צרו פרויקט Vercel נפרד: ` +
    `${mapVercelAppRole(window.location.hostname, "api")} ` +
    `(Root: apps/api, Turso + JWT). הדפדפן קורא לאותו דומיין; middleware מעביר ל־API.`
  );
}

function resolveAppUrl(
  role: "executive" | "admin" | "guest" | "work",
  envKey: string,
  localDefault: string,
): string {
  const fromEnv = viteEnv[envKey]?.replace(/\/$/, "");
  const onVercel =
    typeof window !== "undefined" &&
    window.location.hostname.endsWith(".vercel.app");
  if (onVercel && (!fromEnv || isLocalUrl(fromEnv))) {
    return `https://${mapVercelAppRole(window.location.hostname, role)}`;
  }
  return fromEnv ?? localDefault;
}

type ApiError = {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
};

export async function parseJson(response: Response): Promise<unknown> {
  return response.json();
}

export function toErrorMessage(payload: unknown, fallback: string): string {
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

let refreshInFlight: Promise<boolean> | null = null;

export async function tryRefreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refreshToken = readRefreshToken();
    if (!refreshToken) return false;
    try {
      const response = await fetch(`${getApiBase()}/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      const payload = (await parseJson(response)) as {
        accessToken?: string;
        refreshToken?: string;
      };
      if (
        !response.ok ||
        typeof payload.accessToken !== "string" ||
        typeof payload.refreshToken !== "string"
      ) {
        return false;
      }
      updateTokens({
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
      });
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function authedFetch(
  path: string,
  init: RequestInit = {},
): Promise<{ response: Response; payload: unknown }> {
  const token = readAccessToken();
  if (!token) {
    throw new Error("Missing session");
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  let response = await fetch(`${getApiBase()}${path}`, { ...init, headers });
  let payload = await parseJson(response);

  if (response.status === 401) {
    const refreshed = await tryRefreshSession();
    if (!refreshed) {
      clearSession();
      throw new Error("Session expired");
    }
    const nextToken = readAccessToken();
    if (!nextToken) {
      clearSession();
      throw new Error("Session expired");
    }
    headers.set("Authorization", `Bearer ${nextToken}`);
    response = await fetch(`${getApiBase()}${path}`, { ...init, headers });
    payload = await parseJson(response);
    if (response.status === 401) {
      clearSession();
      throw new Error("Session expired");
    }
  }

  if (!response.ok) {
    throw new Error(toErrorMessage(payload, "Request failed"));
  }
  return { response, payload };
}

export async function authGet(path: string): Promise<unknown> {
  const { payload } = await authedFetch(path);
  return payload;
}

export async function authPost(path: string, body?: unknown): Promise<unknown> {
  const init: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  const { payload } = await authedFetch(path, init);
  return payload;
}

export async function authPatch(path: string, body: unknown): Promise<unknown> {
  const { payload } = await authedFetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return payload;
}

export async function authPut(path: string, body: unknown): Promise<unknown> {
  const { payload } = await authedFetch(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return payload;
}

export function hotelQuery(hotelId: string): string {
  return `hotelId=${encodeURIComponent(hotelId)}`;
}

export const APP_URLS = {
  get executive(): string {
    return resolveAppUrl(
      "executive",
      "VITE_APP_URL_EXECUTIVE",
      "http://localhost:5173",
    );
  },
  get admin(): string {
    return resolveAppUrl("admin", "VITE_APP_URL_ADMIN", "http://localhost:5174");
  },
  get guest(): string {
    return resolveAppUrl("guest", "VITE_APP_URL_GUEST", "http://localhost:5175");
  },
  get work(): string {
    return resolveAppUrl("work", "VITE_APP_URL_WORK", "http://localhost:5176");
  },
  /** Canonical aliases for the four audience surfaces. */
  get hq(): string {
    return APP_URLS.executive;
  },
  get ops(): string {
    return APP_URLS.admin;
  },
  get book(): string {
    return APP_URLS.guest;
  },
  legal(
    doc:
      | "terms"
      | "cookies"
      | "security"
      | "privacy"
      | "meetings"
      | "subprocessors"
      | "dpa"
      | "accessibility",
  ): string {
    return `${APP_URLS.guest}/?doc=${doc}`;
  },
};
