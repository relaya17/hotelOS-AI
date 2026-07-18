import {
  clearSession,
  readAccessToken,
  readRefreshToken,
  saveSession,
  updateTokens,
  type StoredUser,
} from "./session.js";

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
  role: "api" | "admin" | "executive" | "guest",
): string {
  return host
    .replace(/-(admin|executive|guest|api)-/i, `-${role}-`)
    .replace(/-(admin|executive|guest|api)\.vercel\./i, `-${role}.vercel.`);
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
  role: "executive" | "admin" | "guest",
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
  readonly kashrutEnabled: boolean;
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

export type AgentDto = {
  readonly id: string;
  readonly nameHe: string;
  readonly nameEn: string;
  readonly domain: string;
  readonly summaryHe: string;
  readonly autonomyMode: string;
};

export type BriefingRoomSummaryDto = {
  readonly id: string;
  readonly title: string;
  readonly purpose: string;
  readonly status: "scheduled" | "live" | "ended";
  readonly hostUserId: string;
  readonly chainId: string;
  readonly createdAt: string;
};

export type BriefingRecordingDto = {
  readonly id: string;
  readonly tenantId: string;
  readonly chainId: string;
  readonly roomId: string;
  readonly status: "recording" | "completed" | "failed";
  readonly startedByUserId: string;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly storageKey: string | null;
  readonly mimeType: string | null;
  readonly byteSize: number | null;
  readonly durationSeconds: number | null;
  readonly hasTranscript: boolean;
  readonly createdAt: string;
};

export type BriefingRoomDetailDto = {
  readonly room: BriefingRoomSummaryDto;
  readonly participants: readonly {
    readonly id: string;
    readonly displayName: string;
    readonly roleLabel: string;
    readonly userId: string | null;
  }[];
  readonly sharedAgents: readonly {
    readonly id: string;
    readonly agentId: string;
    readonly nameHe: string;
    readonly nameEn: string;
    readonly domain: string;
    readonly summaryHe: string;
    readonly autonomyMode: string;
    readonly sharedAt: string;
  }[];
  readonly messages: readonly {
    readonly id: string;
    readonly speakerKind: "human" | "agent";
    readonly speakerId: string;
    readonly speakerName: string;
    readonly body: string;
    readonly createdAt: string;
  }[];
  readonly recordings: readonly BriefingRecordingDto[];
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

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshSession(): Promise<boolean> {
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

async function authedFetch(
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

async function authGet(path: string): Promise<unknown> {
  const { payload } = await authedFetch(path);
  return payload;
}

export async function login(input: {
  tenantId: string;
  email: string;
  password: string;
}): Promise<LoginResponse> {
  const response = await fetch(`${getApiBase()}/v1/auth/login`, {
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

export async function logout(): Promise<void> {
  const refreshToken = readRefreshToken();
  try {
    if (refreshToken) {
      await fetch(`${getApiBase()}/v1/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
    }
  } finally {
    clearSession();
  }
}

export async function fetchMe(): Promise<LoginResponse["user"]> {
  return (await authGet("/v1/auth/me")) as LoginResponse["user"];
}

/** Consume Google OAuth redirect hash (`#hotelos_oauth=...`) written by the API callback. */
export function consumeOAuthRedirectHash(): StoredUser | null {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash.startsWith("hotelos_oauth=")) return null;
  try {
    const encoded = hash.slice("hotelos_oauth=".length);
    const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
    const json = atob(padded + pad);
    const payload = JSON.parse(json) as LoginResponse;
    if (
      typeof payload.accessToken !== "string" ||
      typeof payload.refreshToken !== "string" ||
      !payload.user
    ) {
      return null;
    }
    const user: StoredUser = {
      id: payload.user.id,
      email: payload.user.email,
      displayName: payload.user.displayName,
      roles: payload.user.roles,
      tenantId: payload.user.scope.tenantId,
      ...(payload.user.scope.hotelId !== undefined
        ? { hotelId: payload.user.scope.hotelId }
        : {}),
    };
    saveSession({
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      user,
    });
    window.history.replaceState({}, "", window.location.pathname);
    return user;
  } catch {
    return null;
  }
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

async function authPost(path: string, body?: unknown): Promise<unknown> {
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

export async function listAgents(): Promise<readonly AgentDto[]> {
  const payload = (await authGet("/v1/agents")) as { data: AgentDto[] };
  return payload.data;
}

export async function listBriefingRooms(): Promise<
  readonly BriefingRoomSummaryDto[]
> {
  const payload = (await authGet("/v1/briefing-rooms")) as {
    data: BriefingRoomSummaryDto[];
  };
  return payload.data;
}

export async function fetchBriefingRoom(
  roomId: string,
): Promise<BriefingRoomDetailDto> {
  const payload = (await authGet(`/v1/briefing-rooms/${roomId}`)) as {
    data: BriefingRoomDetailDto;
  };
  return payload.data;
}

export async function createBriefingRoom(input: {
  title: string;
  purpose: string;
  participants?: readonly { displayName: string; roleLabel: string }[];
}): Promise<BriefingRoomSummaryDto> {
  const payload = (await authPost("/v1/briefing-rooms", input)) as {
    data: BriefingRoomSummaryDto;
  };
  return payload.data;
}

export async function startBriefingRoom(roomId: string): Promise<void> {
  await authPost(`/v1/briefing-rooms/${roomId}/start`);
}

export async function endBriefingRoom(roomId: string): Promise<void> {
  await authPost(`/v1/briefing-rooms/${roomId}/end`);
}

export async function shareAgentToBriefingRoom(
  roomId: string,
  agentId: string,
): Promise<void> {
  await authPost(`/v1/briefing-rooms/${roomId}/agents`, { agentId });
}

export async function postBriefingMessage(
  roomId: string,
  body: string,
): Promise<void> {
  await authPost(`/v1/briefing-rooms/${roomId}/messages`, { body });
}

export async function consultBriefingAgent(
  roomId: string,
  agentId: string,
  prompt?: string,
): Promise<void> {
  await authPost(`/v1/briefing-rooms/${roomId}/agents/${agentId}/consult`, {
    ...(prompt !== undefined ? { prompt } : {}),
  });
}

export async function startBriefingRecording(
  roomId: string,
): Promise<BriefingRecordingDto> {
  const payload = (await authPost(
    `/v1/briefing-rooms/${roomId}/recordings/start`,
  )) as { data: BriefingRecordingDto };
  return payload.data;
}

export async function completeBriefingRecording(
  roomId: string,
  recordingId: string,
  blob: Blob,
  durationSeconds: number | null,
): Promise<BriefingRecordingDto> {
  const token = readAccessToken();
  if (!token) {
    throw new Error("Missing session");
  }
  const form = new FormData();
  form.append("file", blob, "meeting.webm");
  if (durationSeconds !== null) {
    form.append("durationSeconds", String(durationSeconds));
  }
  const response = await fetch(
    `${getApiBase()}/v1/briefing-rooms/${roomId}/recordings/${recordingId}/complete`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    },
  );
  const payload = await parseJson(response);
  if (response.status === 401) {
    clearSession();
    throw new Error("Session expired");
  }
  if (!response.ok) {
    throw new Error(toErrorMessage(payload, "Failed to save recording"));
  }
  return (payload as { data: BriefingRecordingDto }).data;
}

export function briefingRecordingMediaUrl(
  roomId: string,
  recordingId: string,
): string {
  return `${getApiBase()}/v1/briefing-rooms/${roomId}/recordings/${recordingId}/media`;
}

export type EmployeeDto = {
  readonly id: string;
  readonly displayName: string;
  readonly roleLabel: string;
  readonly preferredLocale: string;
  readonly hotelId: string | null;
};

export type StaffChatDeliveryDto = {
  readonly employeeId: string;
  readonly displayName: string;
  readonly preferredLocale: string;
  readonly body: string;
};

export type StaffChatMessageDto = {
  readonly id: string;
  readonly channel: string;
  readonly authorName: string;
  readonly sourceLocale: string;
  readonly sourceBody: string;
  readonly translations: Record<string, string>;
  readonly verification: string;
  readonly createdAt: string;
  readonly bodyForViewer: string;
  readonly deliveries: readonly StaffChatDeliveryDto[];
};

export type AccountingDto = {
  readonly mode: string;
  readonly integration: {
    readonly internalProgram: string;
    readonly externalConnectors: readonly string[];
    readonly note: string;
  };
  readonly accounts: readonly {
    readonly id: string;
    readonly code: string;
    readonly name: string;
    readonly accountType: string;
    readonly currency: string;
    readonly balanceMinor: number;
  }[];
  readonly journal: readonly {
    readonly id: string;
    readonly accountCode: string;
    readonly accountName: string;
    readonly memo: string;
    readonly debit: number;
    readonly credit: number;
    readonly entryDate: string;
    readonly sourceSystem: string;
  }[];
};

export type AutomationBundleDto = {
  readonly rules: readonly {
    readonly id: string;
    readonly name: string;
    readonly domain: string;
    readonly triggerKey: string;
    readonly actionKey: string;
    readonly enabled: boolean;
    readonly lastRunAt: string | null;
  }[];
  readonly runs: readonly {
    readonly id: string;
    readonly automationId: string;
    readonly status: string;
    readonly detail: string;
    readonly createdAt: string;
  }[];
};

export type VoiceIntentDto = {
  readonly intent: string;
  readonly action: string;
  readonly automationHint: string;
  readonly replyHe: string;
  readonly replyEn: string;
  readonly automationId: string | null;
  readonly runId: string | null;
};

export async function fetchStaffChat(
  channel: string,
  locale: string,
): Promise<{
  readonly channel: string;
  readonly viewerLocale: string;
  readonly messages: readonly StaffChatMessageDto[];
}> {
  const payload = (await authGet(
    `/v1/turbo/chat/${channel}?locale=${encodeURIComponent(locale)}`,
  )) as {
    data: {
      channel: string;
      viewerLocale: string;
      messages: StaffChatMessageDto[];
    };
  };
  return payload.data;
}

export async function postStaffChatInstruction(input: {
  channel?: string;
  body: string;
  sourceLocale?: string;
}): Promise<void> {
  await authPost("/v1/turbo/chat", {
    channel: input.channel ?? "ops",
    body: input.body,
    sourceLocale: input.sourceLocale ?? "he",
  });
}

export async function fetchAccounting(): Promise<AccountingDto> {
  const payload = (await authGet("/v1/turbo/accounting")) as {
    data: AccountingDto;
  };
  return payload.data;
}

export async function fetchAutomations(): Promise<AutomationBundleDto> {
  const payload = (await authGet("/v1/turbo/automations")) as {
    data: AutomationBundleDto;
  };
  return payload.data;
}

export async function toggleAutomation(
  id: string,
  enabled: boolean,
): Promise<void> {
  await authPost(`/v1/turbo/automations/${id}/toggle`, { enabled });
}

export async function runAutomation(id: string): Promise<void> {
  await authPost(`/v1/turbo/automations/${id}/run`);
}

export async function submitVoiceIntent(
  transcript: string,
): Promise<VoiceIntentDto> {
  const payload = (await authPost("/v1/turbo/voice/intent", { transcript })) as {
    data: VoiceIntentDto;
  };
  return payload.data;
}

export async function listEmployees(): Promise<readonly EmployeeDto[]> {
  const payload = (await authGet("/v1/turbo/employees")) as {
    data: EmployeeDto[];
  };
  return payload.data;
}

export type LegalDocSummary = {
  readonly id: string;
  readonly titleHe: string;
  readonly titleEn: string;
  readonly version: string;
  readonly updatedAt: string;
};

export type LegalDocDetail = LegalDocSummary & {
  readonly sections: readonly { readonly heading: string; readonly body: string }[];
};

export type AttendanceEventDto = {
  readonly id: string;
  readonly employeeId: string;
  readonly hotelId: string;
  readonly eventType: string;
  readonly occurredAt: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly deviceLabel: string;
  readonly voiceVerified: boolean;
  readonly webauthnVerified: boolean;
  readonly note: string | null;
};

export async function fetchLegalIndex(): Promise<readonly LegalDocSummary[]> {
  const response = await fetch(`${getApiBase()}/v1/public/legal`);
  const payload = (await parseJson(response)) as { data: LegalDocSummary[] };
  if (!response.ok) throw new Error("Failed to load legal index");
  return payload.data;
}

export async function fetchLegalDocument(id: string): Promise<LegalDocDetail> {
  const response = await fetch(`${getApiBase()}/v1/public/legal/${id}`);
  const payload = (await parseJson(response)) as { data: LegalDocDetail };
  if (!response.ok) throw new Error("Failed to load legal document");
  return payload.data;
}

export async function saveCookieConsent(input: {
  subjectKey: string;
  necessary: boolean;
  functional: boolean;
  tenantId?: string;
}): Promise<void> {
  const response = await fetch(`${getApiBase()}/v1/trust/cookies/consent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error("Failed to save cookie consent");
}

export async function loginWithGoogleDemo(input: {
  tenantId: string;
  email: string;
}): Promise<LoginResponse> {
  const response = await fetch(`${getApiBase()}/v1/trust/oauth/google/demo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(toErrorMessage(payload, "Google demo login failed"));
  }
  return payload as LoginResponse;
}

export async function startGoogleOAuth(tenantId: string): Promise<
  | { readonly mode: "demo"; readonly demoEndpoint: string }
  | { readonly mode: "oauth"; readonly url: string }
> {
  const response = await fetch(
    `${getApiBase()}/v1/trust/oauth/google/start?tenantId=${encodeURIComponent(tenantId)}`,
  );
  const payload = (await parseJson(response)) as {
    data?: {
      mode?: string;
      url?: string;
      demoEndpoint?: string;
    };
  };
  if (!response.ok || !payload.data) {
    throw new Error("Failed to start Google OAuth");
  }
  if (payload.data.mode === "oauth" && typeof payload.data.url === "string") {
    return { mode: "oauth", url: payload.data.url };
  }
  return {
    mode: "demo",
    demoEndpoint: payload.data.demoEndpoint ?? "/v1/trust/oauth/google/demo",
  };
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBuffer(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function createWebAuthnLoginChallenge(input: {
  tenantId: string;
  email: string;
}): Promise<{
  readonly challenge: string;
  readonly allowCredentials: readonly string[];
  readonly rpId: string;
}> {
  const response = await fetch(`${getApiBase()}/v1/trust/webauthn/login-challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = (await parseJson(response)) as {
    data?: {
      challenge: string;
      allowCredentials: string[];
      rpId: string;
    };
  };
  if (!response.ok || !payload.data) {
    throw new Error(toErrorMessage(payload, "WebAuthn login challenge failed"));
  }
  return payload.data;
}

export async function assertWebAuthnLogin(input: {
  tenantId: string;
  credentialId: string;
  challenge: string;
  clientDataJSON: string;
}): Promise<LoginResponse> {
  const response = await fetch(`${getApiBase()}/v1/trust/webauthn/assert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(toErrorMessage(payload, "WebAuthn login failed"));
  }
  return payload as LoginResponse;
}

export async function loginWithWebAuthn(input: {
  tenantId: string;
  email: string;
}): Promise<LoginResponse> {
  if (!window.PublicKeyCredential) {
    throw new Error("המכשיר לא תומך ב־WebAuthn");
  }
  const challenge = await createWebAuthnLoginChallenge(input);
  const credential = (await navigator.credentials.get({
    publicKey: {
      challenge: base64UrlToBuffer(challenge.challenge),
      rpId: challenge.rpId,
      allowCredentials: challenge.allowCredentials.map((id) => ({
        type: "public-key" as const,
        id: base64UrlToBuffer(id),
      })),
      userVerification: "required",
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!credential) {
    throw new Error("בוטלה התחברות ביומטרית");
  }
  const response = credential.response as AuthenticatorAssertionResponse;
  return assertWebAuthnLogin({
    tenantId: input.tenantId,
    credentialId: bufferToBase64Url(credential.rawId),
    challenge: challenge.challenge,
    clientDataJSON: bufferToBase64Url(response.clientDataJSON),
  });
}

export async function assertWebAuthnForSession(): Promise<{
  readonly credentialId: string;
  readonly challenge: string;
} | null> {
  if (!window.PublicKeyCredential) return null;
  try {
    const challenge = await createWebAuthnChallenge("assert");
    const credential = (await navigator.credentials.get({
      publicKey: {
        challenge: base64UrlToBuffer(challenge.challenge),
        rpId: challenge.rp.id,
        userVerification: "required",
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;
    if (!credential) return null;
    return {
      credentialId: bufferToBase64Url(credential.rawId),
      challenge: challenge.challenge,
    };
  } catch {
    return null;
  }
}

export async function createPaymentIntent(input: {
  amountMinor: number;
  currency?: string;
  description: string;
  hotelId?: string;
}): Promise<{ readonly id: string; readonly status: string }> {
  const payload = (await authPost("/v1/trust/payments/intents", input)) as {
    data: { id: string; status: string };
  };
  return payload.data;
}

export async function confirmPaymentIntent(
  id: string,
): Promise<{ readonly id: string; readonly status: string }> {
  const payload = (await authPost(
    `/v1/trust/payments/intents/${id}/confirm`,
  )) as { data: { id: string; status: string } };
  return payload.data;
}

export async function listPayments(): Promise<
  readonly {
    readonly id: string;
    readonly amountMinor: number;
    readonly currency: string;
    readonly status: string;
    readonly description: string;
    readonly createdAt: string;
  }[]
> {
  const payload = (await authGet("/v1/trust/payments/intents")) as {
    data: {
      id: string;
      amountMinor: number;
      currency: string;
      status: string;
      description: string;
      createdAt: string;
    }[];
  };
  return payload.data;
}

export async function createDigitalSignature(input: {
  subjectType: "attendance" | "booking" | "payment" | "document";
  subjectId: string;
  signerName: string;
  purpose: string;
  imageDataUrl: string;
}): Promise<{ readonly id: string; readonly contentHash: string }> {
  const payload = (await authPost("/v1/trust/signatures", input)) as {
    data: { id: string; contentHash: string };
  };
  return payload.data;
}

export async function createWebAuthnChallenge(
  purpose: "register" | "assert" = "register",
): Promise<{
  readonly challenge: string;
  readonly rp: { readonly id: string; readonly name: string };
}> {
  const payload = (await authPost(
    `/v1/trust/webauthn/challenge?purpose=${purpose}`,
  )) as {
    data: {
      challenge: string;
      rp: { id: string; name: string };
    };
  };
  return payload.data;
}

export async function registerWebAuthnCredential(input: {
  credentialId: string;
  publicKeyJwkJson: string;
  challenge: string;
  deviceLabel?: string;
}): Promise<void> {
  await authPost("/v1/trust/webauthn/register", input);
}

export async function enrollVoiceSample(input: {
  sampleBase64: string;
  phrase?: string;
}): Promise<void> {
  await authPost("/v1/trust/voice/enroll", input);
}

export async function listAttendance(): Promise<readonly AttendanceEventDto[]> {
  const payload = (await authGet("/v1/trust/attendance")) as {
    data: AttendanceEventDto[];
  };
  return payload.data;
}

export async function clockAttendance(input: {
  employeeId: string;
  hotelId: string;
  eventType: "clock_in" | "clock_out";
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  deviceLabel?: string;
  signatureId?: string;
  voiceSampleBase64?: string;
  webauthnCredentialId?: string;
  webauthnChallenge?: string;
  note?: string;
}): Promise<AttendanceEventDto & { voiceVerified: boolean; webauthnVerified: boolean }> {
  const payload = (await authPost("/v1/trust/attendance/clock", input)) as {
    data: AttendanceEventDto & {
      voiceVerified: boolean;
      webauthnVerified: boolean;
    };
  };
  return payload.data;
}

// ---- Ops module: departments, maintenance, procurement, feedback, recruiting ----

async function authPatch(path: string, body: unknown): Promise<unknown> {
  const { payload } = await authedFetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return payload;
}

export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "open" | "in_progress" | "blocked" | "done" | "cancelled";

export type DepartmentSummaryDto = {
  readonly id: string;
  readonly hotelId: string;
  readonly code: string;
  readonly name: string;
};

export type DepartmentDto = DepartmentSummaryDto & { readonly staffCount: number };

export type DepartmentTaskDto = {
  readonly id: string;
  readonly tenantId: string;
  readonly hotelId: string;
  readonly departmentId: string;
  readonly taskType: string;
  readonly title: string;
  readonly description: string;
  readonly priority: TaskPriority;
  readonly status: TaskStatus;
  readonly assignedToUserId: string | null;
  readonly dueAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type MaintenanceCategory =
  | "repair"
  | "renovation"
  | "pool"
  | "linen"
  | "general";
export type MaintenanceStatus =
  | "open"
  | "quote_requested"
  | "approved"
  | "in_progress"
  | "done"
  | "cancelled";

export type MaintenanceRequestDto = {
  readonly id: string;
  readonly tenantId: string;
  readonly hotelId: string;
  readonly category: MaintenanceCategory;
  readonly title: string;
  readonly description: string;
  readonly priority: TaskPriority;
  readonly status: MaintenanceStatus;
  readonly vendorId: string | null;
  readonly dueAt: string | null;
  readonly estimatedCost: number | null;
  readonly actualCost: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type VendorCategory = "contractor" | "supplier" | "both";
export type VendorDto = {
  readonly id: string;
  readonly tenantId: string;
  readonly hotelId: string | null;
  readonly name: string;
  readonly category: VendorCategory;
  readonly contactName: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly rating: number | null;
};

export type QuoteStatus = "pending" | "accepted" | "rejected" | "expired";
export type VendorQuoteDto = {
  readonly id: string;
  readonly maintenanceRequestId: string | null;
  readonly vendorId: string;
  readonly amount: number;
  readonly currency: string;
  readonly status: QuoteStatus;
  readonly submittedAt: string;
};

export type InventoryCategory =
  | "towels"
  | "linens"
  | "pool_chemicals"
  | "cleaning"
  | "amenities"
  | "other";
export type InventoryItemDto = {
  readonly id: string;
  readonly hotelId: string;
  readonly category: InventoryCategory;
  readonly name: string;
  readonly unit: string;
  readonly currentStock: number;
  readonly reorderThreshold: number;
  readonly belowThreshold: boolean;
};

export type PurchaseOrderStatus =
  | "draft"
  | "sent"
  | "confirmed"
  | "received"
  | "paid"
  | "cancelled";
export type PurchaseOrderDto = {
  readonly id: string;
  readonly hotelId: string;
  readonly vendorId: string;
  readonly status: PurchaseOrderStatus;
  readonly totalAmount: number;
  readonly currency: string;
  readonly createdAt: string;
};

export type GuestFeedbackDto = {
  readonly id: string;
  readonly hotelId: string;
  readonly bookingId: string | null;
  readonly rating: number;
  readonly categories: readonly string[];
  readonly comment: string | null;
  readonly source: string;
  readonly submittedAt: string;
};

export type JobPostingStatus = "open" | "closed";
export type JobPostingDto = {
  readonly id: string;
  readonly hotelId: string;
  readonly title: string;
  readonly boardName: string;
  readonly externalUrl: string | null;
  readonly status: JobPostingStatus;
  readonly createdAt: string;
};

export type CandidateStage =
  | "applied"
  | "screening"
  | "interview"
  | "offer"
  | "hired"
  | "rejected";
export type JobCandidateDto = {
  readonly id: string;
  readonly jobPostingId: string;
  readonly fullName: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly source: string;
  readonly stage: CandidateStage;
};

export type OpsDashboardHotelDto = {
  readonly hotelId: string;
  readonly hotelName: string;
  readonly departmentCount: number;
  readonly openMaintenanceRequests: number;
  readonly pendingQuoteRequests: number;
  readonly lowStockItems: number;
  readonly openPurchaseOrders: number;
  readonly averageFeedbackRating: number | null;
};

function hotelQuery(hotelId: string): string {
  return `hotelId=${encodeURIComponent(hotelId)}`;
}

export async function listDepartments(
  hotelId: string,
): Promise<readonly DepartmentDto[]> {
  const payload = (await authGet(
    `/v1/ops/departments?${hotelQuery(hotelId)}`,
  )) as { data: DepartmentDto[] };
  return payload.data;
}

export async function fetchDepartmentTasks(
  hotelId: string,
  code: string,
): Promise<{
  readonly department: DepartmentSummaryDto;
  readonly tasks: readonly DepartmentTaskDto[];
}> {
  const payload = (await authGet(
    `/v1/ops/departments/${encodeURIComponent(code)}/tasks?${hotelQuery(hotelId)}`,
  )) as { data: { department: DepartmentSummaryDto; tasks: DepartmentTaskDto[] } };
  return payload.data;
}

export async function createDepartmentTask(
  hotelId: string,
  code: string,
  input: {
    taskType: string;
    title: string;
    description: string;
    priority?: TaskPriority;
    dueAt?: string;
  },
): Promise<DepartmentTaskDto> {
  const payload = (await authPost(
    `/v1/ops/departments/${encodeURIComponent(code)}/tasks?${hotelQuery(hotelId)}`,
    input,
  )) as { data: DepartmentTaskDto };
  return payload.data;
}

export async function updateDepartmentTaskStatus(
  taskId: string,
  status: TaskStatus,
): Promise<DepartmentTaskDto> {
  const payload = (await authPatch(`/v1/ops/tasks/${taskId}`, { status })) as {
    data: DepartmentTaskDto;
  };
  return payload.data;
}

export async function listMaintenanceRequests(
  hotelId: string,
): Promise<readonly MaintenanceRequestDto[]> {
  const payload = (await authGet(
    `/v1/ops/maintenance-requests?${hotelQuery(hotelId)}`,
  )) as { data: MaintenanceRequestDto[] };
  return payload.data;
}

export async function createMaintenanceRequest(
  hotelId: string,
  input: {
    category: MaintenanceCategory;
    title: string;
    description: string;
    priority?: TaskPriority;
    dueAt?: string;
  },
): Promise<MaintenanceRequestDto> {
  const payload = (await authPost(
    `/v1/ops/maintenance-requests?${hotelQuery(hotelId)}`,
    input,
  )) as { data: MaintenanceRequestDto };
  return payload.data;
}

export async function updateMaintenanceRequestStatus(
  requestId: string,
  status: MaintenanceStatus,
): Promise<MaintenanceRequestDto> {
  const payload = (await authPatch(
    `/v1/ops/maintenance-requests/${requestId}`,
    { status },
  )) as { data: MaintenanceRequestDto };
  return payload.data;
}

export async function listVendors(): Promise<readonly VendorDto[]> {
  const payload = (await authGet("/v1/ops/vendors")) as { data: VendorDto[] };
  return payload.data;
}

export async function createVendor(input: {
  name: string;
  category: VendorCategory;
  contactName?: string;
  phone?: string;
  email?: string;
}): Promise<VendorDto> {
  const payload = (await authPost("/v1/ops/vendors", input)) as {
    data: VendorDto;
  };
  return payload.data;
}

export async function createVendorQuote(
  requestId: string,
  input: {
    vendorId: string;
    amount: number;
    currency?: string;
    validUntil?: string;
  },
): Promise<VendorQuoteDto> {
  const payload = (await authPost(
    `/v1/ops/maintenance-requests/${requestId}/quotes`,
    input,
  )) as { data: VendorQuoteDto };
  return payload.data;
}

export async function listQuotesForRequest(
  requestId: string,
): Promise<readonly VendorQuoteDto[]> {
  const payload = (await authGet(
    `/v1/ops/maintenance-requests/${requestId}/quotes`,
  )) as { data: VendorQuoteDto[] };
  return payload.data;
}

export async function decideQuote(
  quoteId: string,
  status: "accepted" | "rejected",
): Promise<VendorQuoteDto> {
  const payload = (await authPost(`/v1/ops/quotes/${quoteId}/decision`, {
    status,
  })) as { data: VendorQuoteDto };
  return payload.data;
}

export async function listInventory(
  hotelId: string,
): Promise<readonly InventoryItemDto[]> {
  const payload = (await authGet(`/v1/ops/inventory?${hotelQuery(hotelId)}`)) as {
    data: InventoryItemDto[];
  };
  return payload.data;
}

export async function createInventoryItem(
  hotelId: string,
  input: {
    category: InventoryCategory;
    name: string;
    unit: string;
    currentStock: number;
    reorderThreshold: number;
  },
): Promise<InventoryItemDto> {
  const payload = (await authPost(
    `/v1/ops/inventory?${hotelQuery(hotelId)}`,
    input,
  )) as { data: InventoryItemDto };
  return payload.data;
}

export async function listPurchaseOrders(
  hotelId: string,
): Promise<readonly PurchaseOrderDto[]> {
  const payload = (await authGet(
    `/v1/ops/purchase-orders?${hotelQuery(hotelId)}`,
  )) as { data: PurchaseOrderDto[] };
  return payload.data;
}

export async function createPurchaseOrder(
  hotelId: string,
  input: {
    vendorId: string;
    currency?: string;
    notes?: string;
    items: readonly {
      inventoryItemId?: string;
      description: string;
      quantity: number;
      unitPrice: number;
    }[];
  },
): Promise<PurchaseOrderDto> {
  const payload = (await authPost(
    `/v1/ops/purchase-orders?${hotelQuery(hotelId)}`,
    input,
  )) as { data: PurchaseOrderDto };
  return payload.data;
}

export async function receivePurchaseOrder(
  orderId: string,
): Promise<PurchaseOrderDto> {
  const payload = (await authPost(
    `/v1/ops/purchase-orders/${orderId}/receive`,
  )) as { data: PurchaseOrderDto };
  return payload.data;
}

export async function fetchOpsFeedback(hotelId: string): Promise<{
  readonly average: number | null;
  readonly items: readonly GuestFeedbackDto[];
}> {
  const payload = (await authGet(`/v1/ops/feedback?${hotelQuery(hotelId)}`)) as {
    data: { average: number | null; items: GuestFeedbackDto[] };
  };
  return payload.data;
}

export async function submitGuestFeedback(input: {
  bookingId: string;
  rating: number;
  categories: readonly string[];
  comment?: string;
}): Promise<GuestFeedbackDto> {
  const response = await fetch(`${getApiBase()}/v1/public/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(toErrorMessage(payload, "Feedback submission failed"));
  }
  return (payload as { data: GuestFeedbackDto }).data;
}

export async function listJobPostings(
  hotelId: string,
): Promise<readonly JobPostingDto[]> {
  const payload = (await authGet(
    `/v1/ops/recruiting/postings?${hotelQuery(hotelId)}`,
  )) as { data: JobPostingDto[] };
  return payload.data;
}

export async function createJobPosting(
  hotelId: string,
  input: {
    title: string;
    boardName: string;
    externalUrl?: string;
    notes?: string;
  },
): Promise<JobPostingDto> {
  const payload = (await authPost(
    `/v1/ops/recruiting/postings?${hotelQuery(hotelId)}`,
    input,
  )) as { data: JobPostingDto };
  return payload.data;
}

export async function listJobCandidates(
  postingId: string,
): Promise<readonly JobCandidateDto[]> {
  const payload = (await authGet(
    `/v1/ops/recruiting/postings/${postingId}/candidates`,
  )) as { data: JobCandidateDto[] };
  return payload.data;
}

export async function addJobCandidate(
  postingId: string,
  input: { fullName: string; phone?: string; email?: string; source: string },
): Promise<JobCandidateDto> {
  const payload = (await authPost(
    `/v1/ops/recruiting/postings/${postingId}/candidates`,
    input,
  )) as { data: JobCandidateDto };
  return payload.data;
}

export async function fetchOpsDashboard(): Promise<{
  readonly hotels: readonly OpsDashboardHotelDto[];
}> {
  const payload = (await authGet("/v1/ops/dashboard")) as {
    data: { hotels: OpsDashboardHotelDto[] };
  };
  return payload.data;
}

export type DailyBriefingHotelDto = {
  readonly hotelId: string;
  readonly hotelName: string;
  readonly occupancyPercent: number;
  readonly activeBookings: number;
  readonly roomsNeedingCleaning: number;
  readonly departmentCount: number;
  readonly openMaintenanceRequests: number;
  readonly urgentMaintenanceRequests: number;
  readonly lowStockItems: number;
  readonly openPurchaseOrders: number;
  readonly averageFeedbackRating: number | null;
  readonly highlights: readonly string[];
  readonly warnings: readonly string[];
  readonly suggestedActions: readonly string[];
  readonly summaryHe: string;
};

export type DailyBriefingDto = {
  readonly generatedAt: string;
  readonly tenantName: string;
  readonly hotels: readonly DailyBriefingHotelDto[];
  readonly chainSummaryHe: string | null;
};

export async function fetchDailyBriefing(): Promise<DailyBriefingDto> {
  const payload = (await authGet("/v1/ops/daily-briefing")) as {
    data: DailyBriefingDto;
  };
  return payload.data;
}

// ---- ADR 0007: CIO orchestrator, org comms, trusted knowledge, kashrut ----

export type CioRole =
  | "owner"
  | "ceo"
  | "cfo"
  | "reception"
  | "housekeeping"
  | "fb";

export type CioDigestSectionDto = {
  readonly hotelId: string;
  readonly hotelName: string;
  readonly kashrutEnabled: boolean;
  readonly bulletsHe: readonly string[];
  readonly kashrutNoteHe: string | null;
};

export type CioDigestDto = {
  readonly role: CioRole;
  readonly roleLabelHe: string;
  readonly generatedAt: string;
  readonly tenantName: string;
  readonly headlineHe: string;
  readonly sections: readonly CioDigestSectionDto[];
};

export async function fetchCioDigest(role: CioRole): Promise<CioDigestDto> {
  const payload = (await authGet(
    `/v1/ops/cio-digest?role=${encodeURIComponent(role)}`,
  )) as { data: CioDigestDto };
  return payload.data;
}

export type OrgCommsChannelDto = {
  readonly id: string;
  readonly tenantId: string;
  readonly chainId: string;
  readonly hotelId: string | null;
  readonly channelKey: string;
  readonly nameHe: string;
  readonly createdAt: string;
};

export type OrgCommsMessageDto = {
  readonly id: string;
  readonly channelId: string;
  readonly fromRole: string;
  readonly body: string;
  readonly createdByUserId: string | null;
  readonly createdAt: string;
};

export async function listOrgCommsChannels(): Promise<
  readonly OrgCommsChannelDto[]
> {
  const payload = (await authGet("/v1/org-comms/channels")) as {
    data: OrgCommsChannelDto[];
  };
  return payload.data;
}

export async function listOrgCommsMessages(
  channelId: string,
): Promise<readonly OrgCommsMessageDto[]> {
  const payload = (await authGet(
    `/v1/org-comms/channels/${channelId}/messages`,
  )) as { data: OrgCommsMessageDto[] };
  return payload.data;
}

export async function postOrgCommsMessage(
  channelId: string,
  input: { fromRole: string; body: string },
): Promise<OrgCommsMessageDto> {
  const payload = (await authPost(
    `/v1/org-comms/channels/${channelId}/messages`,
    input,
  )) as { data: OrgCommsMessageDto };
  return payload.data;
}

export type TrustedSourceCategory =
  | "regulator"
  | "university"
  | "market_data"
  | "accounting_standard"
  | "kashrut_authority"
  | "other";

export type TrustedSourceDto = {
  readonly id: string;
  readonly tenantId: string;
  readonly title: string;
  readonly url: string;
  readonly category: string;
  readonly approvedAt: string;
  readonly approvedByUserId: string | null;
  readonly createdAt: string;
};

export async function listTrustedSources(): Promise<
  readonly TrustedSourceDto[]
> {
  const payload = (await authGet("/v1/knowledge/trusted-sources")) as {
    data: TrustedSourceDto[];
  };
  return payload.data;
}

export async function createTrustedSource(input: {
  title: string;
  url: string;
  category: TrustedSourceCategory;
}): Promise<TrustedSourceDto> {
  const payload = (await authPost(
    "/v1/knowledge/trusted-sources",
    input,
  )) as { data: TrustedSourceDto };
  return payload.data;
}

export type KashrutTargetKind =
  | "procurement"
  | "menu"
  | "briefing"
  | "event"
  | "other";
export type KashrutStatus = "ok" | "note" | "warn" | "block";

export type KashrutAnnotationDto = {
  readonly id: string;
  readonly tenantId: string;
  readonly hotelId: string;
  readonly targetKind: KashrutTargetKind;
  readonly targetId: string;
  readonly status: KashrutStatus;
  readonly message: string | null;
  readonly createdByUserId: string | null;
  readonly createdAt: string;
};

export async function fetchKashrutAnnotations(
  hotelId: string,
  targetKind?: KashrutTargetKind,
): Promise<{
  readonly kashrutEnabled: boolean;
  readonly annotations: readonly KashrutAnnotationDto[];
}> {
  const query = new URLSearchParams({ hotelId });
  if (targetKind) query.set("targetKind", targetKind);
  const payload = (await authGet(
    `/v1/kashrut/annotations?${query.toString()}`,
  )) as {
    data: { kashrutEnabled: boolean; annotations: KashrutAnnotationDto[] };
  };
  return payload.data;
}

export async function createKashrutAnnotation(
  hotelId: string,
  input: {
    targetKind: KashrutTargetKind;
    targetId: string;
    status: KashrutStatus;
    message?: string;
  },
): Promise<KashrutAnnotationDto> {
  const payload = (await authPost(
    `/v1/kashrut/annotations?${hotelQuery(hotelId)}`,
    input,
  )) as { data: KashrutAnnotationDto };
  return payload.data;
}

export type AiGatewayStatusDto = {
  readonly primaryProvider: "deterministic" | "openai_compatible";
  readonly entrypoint: string;
};

export type AiGatewayInvokeResultDto = {
  readonly agentId: string;
  readonly provider: "deterministic" | "openai_compatible";
  readonly answerHe: string;
  readonly confidence: "high" | "medium" | "low";
  readonly citations: readonly {
    readonly title: string;
    readonly url?: string;
    readonly source: "internal" | "trusted" | "company";
  }[];
  readonly requiresHumanApproval: boolean;
  readonly approvalReasonHe?: string;
  readonly latencyMs: number;
  readonly model?: string;
};

export async function fetchAiGatewayStatus(): Promise<AiGatewayStatusDto> {
  const payload = (await authGet("/v1/ai/gateway/status")) as {
    data: AiGatewayStatusDto;
  };
  return payload.data;
}

export async function invokeAiGateway(input: {
  readonly agentId: string;
  readonly message: string;
  readonly hotelId?: string;
  readonly locale?: "he" | "en";
  readonly contextPack?: string;
}): Promise<AiGatewayInvokeResultDto> {
  const payload = (await authPost("/v1/ai/gateway/invoke", input)) as {
    data: AiGatewayInvokeResultDto;
  };
  return payload.data;
}

export type HrEmployeeDto = {
  readonly id: string;
  readonly userId: string | null;
  readonly displayName: string;
  readonly roleLabel: string;
  readonly preferredLocale: string;
  readonly hotelId: string | null;
  readonly employeeCode: string | null;
  readonly phone: string | null;
  readonly status: string;
  readonly departmentId: string | null;
  readonly createdAt: string;
};

export type HrInviteDto = {
  readonly id: string;
  readonly email: string;
  readonly displayNameHint: string;
  readonly roleHint: string;
  readonly expiresAt: string;
  readonly consumedAt: string | null;
  readonly createdAt: string;
};

export async function listHrEmployees(
  hotelId?: string,
): Promise<readonly HrEmployeeDto[]> {
  const qs = hotelId ? `?${hotelQuery(hotelId)}` : "";
  const payload = (await authGet(`/v1/hr/employees${qs}`)) as {
    data: HrEmployeeDto[];
  };
  return payload.data;
}

export async function listHrInvites(
  hotelId: string,
): Promise<readonly HrInviteDto[]> {
  const payload = (await authGet(
    `/v1/hr/invites?${hotelQuery(hotelId)}`,
  )) as { data: HrInviteDto[] };
  return payload.data;
}

export type HrDocumentDto = {
  readonly id: string;
  readonly docType: string;
  readonly status: string;
  readonly contentHash: string | null;
  readonly issuingAuthority: string | null;
  readonly expiresAt: string | null;
  readonly uploadedAt: string;
};

export type HrEmployeeDetailDto = HrEmployeeDto & {
  readonly documents: readonly HrDocumentDto[];
};

export async function fetchHrEmployee(
  employeeId: string,
): Promise<HrEmployeeDetailDto> {
  const payload = (await authGet(`/v1/hr/employees/${employeeId}`)) as {
    data: HrEmployeeDetailDto;
  };
  return payload.data;
}

export async function registerHrDocumentFlag(
  employeeId: string,
  input: {
    readonly docType:
      | "criminal_record_clearance"
      | "id_card"
      | "contract"
      | "certification"
      | "other";
    readonly contentHash?: string;
    readonly issuingAuthority?: string;
    readonly issuedAt?: string;
    readonly expiresAt?: string;
    readonly notes?: string;
  },
): Promise<{ readonly id: string; readonly status: string }> {
  const payload = (await authPost(
    `/v1/hr/employees/${employeeId}/documents`,
    input,
  )) as { data: { id: string; status: string } };
  return payload.data;
}

export async function reviewHrDocument(
  documentId: string,
  input: {
    readonly status: "approved" | "rejected" | "expired";
    readonly notes?: string;
  },
): Promise<{ readonly id: string; readonly status: string }> {
  const payload = (await authPost(
    `/v1/hr/documents/${documentId}/review`,
    input,
  )) as { data: { id: string; status: string } };
  return payload.data;
}

export async function createHrInvite(input: {
  readonly hotelId: string;
  readonly email: string;
  readonly displayNameHint: string;
  readonly roleHint: string;
  readonly departmentId?: string;
  readonly expiresInDays?: number;
}): Promise<{
  readonly id: string;
  readonly email: string;
  readonly expiresAt: string;
  readonly inviteUrlPath: string;
  readonly token: string;
}> {
  const payload = (await authPost("/v1/hr/invites", input)) as {
    data: {
      id: string;
      email: string;
      expiresAt: string;
      inviteUrlPath: string;
      token: string;
    };
  };
  return payload.data;
}

export type PublicHrInviteDto = {
  readonly email: string;
  readonly displayNameHint: string;
  readonly roleHint: string;
  readonly hotelId: string;
  readonly expiresAt: string;
};

export async function fetchPublicHrInvite(
  token: string,
): Promise<PublicHrInviteDto> {
  const response = await fetch(
    `${getApiBase()}/v1/public/hr/invites/${encodeURIComponent(token)}`,
  );
  if (!response.ok) {
    throw new Error("ההזמנה לא זמינה או שפגה");
  }
  const payload = (await response.json()) as { data: PublicHrInviteDto };
  return payload.data;
}

export async function completePublicHrInvite(
  token: string,
  input: {
    readonly displayName: string;
    readonly phone?: string;
    readonly nationalId?: string;
    readonly address?: string;
    readonly emergencyContactName?: string;
    readonly emergencyContactPhone?: string;
    readonly preferredLocale?: string;
    readonly password: string;
  },
): Promise<{
  readonly employeeId: string;
  readonly employeeCode: string | null;
  readonly userId: string;
}> {
  const response = await fetch(
    `${getApiBase()}/v1/public/hr/invites/${encodeURIComponent(token)}/complete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    throw new Error("השלמת ההרשמה נכשלה");
  }
  const payload = (await response.json()) as {
    data: {
      employeeId: string;
      employeeCode: string | null;
      userId: string;
    };
  };
  return payload.data;
}

export type LetterDraftDto = {
  readonly id: string;
  readonly kind: string;
  readonly subject: string;
  readonly recipientLabel: string;
  readonly body: string;
  readonly status: string;
  readonly createdAt: string;
};

export async function listLetterDrafts(
  hotelId?: string,
): Promise<readonly LetterDraftDto[]> {
  const qs = hotelId ? `?${hotelQuery(hotelId)}` : "";
  const payload = (await authGet(`/v1/correspondence/drafts${qs}`)) as {
    data: LetterDraftDto[];
  };
  return payload.data;
}

export async function createLetterDraft(input: {
  readonly kind: "formal_letter" | "purchase_note" | "speech";
  readonly subject: string;
  readonly recipientLabel: string;
  readonly hotelId?: string;
  readonly contextNotes?: string;
}): Promise<LetterDraftDto> {
  const payload = (await authPost("/v1/correspondence/drafts", input)) as {
    data: LetterDraftDto;
  };
  return payload.data;
}

export async function updateLetterDraftStatus(
  draftId: string,
  status: "draft" | "approved" | "discarded",
): Promise<LetterDraftDto> {
  const payload = (await authPost(
    `/v1/correspondence/drafts/${draftId}/status`,
    { status },
  )) as { data: LetterDraftDto };
  return payload.data;
}

export type AiApprovalDto = {
  readonly id: string;
  readonly agentId: string;
  readonly summaryHe: string;
  readonly reasonHe: string;
  readonly status: string;
  readonly createdAt: string;
};

export async function listPendingAiApprovals(): Promise<
  readonly AiApprovalDto[]
> {
  const payload = (await authGet("/v1/ai/approvals/pending")) as {
    data: AiApprovalDto[];
  };
  return payload.data;
}

export async function decideAiApproval(
  id: string,
  status: "approved" | "rejected",
): Promise<AiApprovalDto> {
  const payload = (await authPost(`/v1/ai/approvals/${id}/decide`, {
    status,
  })) as { data: AiApprovalDto };
  return payload.data;
}

export async function postSecurityEvent(input: {
  readonly hotelId: string;
  readonly title: string;
  readonly description: string;
  readonly priority?: "low" | "medium" | "high" | "urgent";
  readonly source?: string;
}): Promise<unknown> {
  return authPost("/v1/ops/security-events", input);
}

export async function postErrorEvent(input: {
  readonly hotelId?: string;
  readonly title: string;
  readonly description: string;
  readonly priority?: "low" | "medium" | "high" | "urgent";
  readonly source?: string;
  readonly app?: string;
}): Promise<unknown> {
  return authPost("/v1/ops/error-events", input);
}

export type AssessmentTemplateDto = {
  readonly id: string;
  readonly titleHe: string;
  readonly titleEn: string;
  readonly category: string;
  readonly passingScore: number;
  readonly questionCount: number;
};

export async function listAssessmentTemplates(): Promise<
  readonly AssessmentTemplateDto[]
> {
  const payload = (await authGet("/v1/hr/assessment-templates")) as {
    data: AssessmentTemplateDto[];
  };
  return payload.data;
}

export async function assignAssessment(
  employeeId: string,
  templateId: string,
): Promise<unknown> {
  return authPost(`/v1/hr/employees/${employeeId}/assessments`, {
    templateId,
  });
}

export async function listEmployeeAssessments(
  employeeId: string,
): Promise<
  readonly {
    readonly id: string;
    readonly templateId: string;
    readonly status: string;
    readonly titleHe?: string;
    readonly createdAt: string;
  }[]
> {
  const payload = (await authGet(
    `/v1/hr/employees/${employeeId}/assessments`,
  )) as {
    data: {
      id: string;
      templateId: string;
      status: string;
      titleHe?: string;
      createdAt: string;
    }[];
  };
  return payload.data;
}

export type CompanyKnowledgeDocDto = {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly category: string;
  readonly status: string;
  readonly createdAt: string;
};

export async function listCompanyKnowledgeDocs(
  status?: string,
): Promise<readonly CompanyKnowledgeDocDto[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  const payload = (await authGet(`/v1/knowledge/company-docs${qs}`)) as {
    data: CompanyKnowledgeDocDto[];
  };
  return payload.data;
}

export async function createCompanyKnowledgeDoc(input: {
  readonly title: string;
  readonly body: string;
  readonly category: "brand" | "sop" | "policy" | "letter_template" | "other";
}): Promise<CompanyKnowledgeDocDto> {
  const payload = (await authPost("/v1/knowledge/company-docs", input)) as {
    data: CompanyKnowledgeDocDto;
  };
  return payload.data;
}

export async function approveCompanyKnowledgeDoc(
  id: string,
): Promise<CompanyKnowledgeDocDto> {
  const payload = (await authPost(
    `/v1/knowledge/company-docs/${id}/approve`,
    {},
  )) as { data: CompanyKnowledgeDocDto };
  return payload.data;
}

export async function searchCompanyKnowledgeDocs(
  query: string,
): Promise<readonly CompanyKnowledgeDocDto[]> {
  const payload = (await authGet(
    `/v1/knowledge/company-docs/search?q=${encodeURIComponent(query)}`,
  )) as { data: CompanyKnowledgeDocDto[] };
  return payload.data;
}

export type HotelTwinDto = {
  readonly hotelId: string;
  readonly generatedAt: string;
  readonly rooms: readonly {
    readonly roomNumber: string;
    readonly status: string;
    readonly source: string;
  }[];
  readonly pms?: {
    readonly providerId: string;
    readonly externalHotelId: string;
    readonly fetchedAt: string;
    readonly reservationCount: number;
  };
};

export async function fetchHotelTwin(hotelId: string): Promise<HotelTwinDto> {
  const payload = (await authGet(`/v1/twin/hotels/${hotelId}`)) as {
    data: HotelTwinDto;
  };
  return payload.data;
}

export async function syncHotelTwinPms(hotelId: string): Promise<{
  readonly twin: HotelTwinDto;
  readonly sync: { readonly noteHe: string; readonly providerId: string };
}> {
  const payload = (await authPost(
    `/v1/twin/hotels/${hotelId}/pms-sync`,
    {},
  )) as {
    data: {
      twin: HotelTwinDto;
      sync: { noteHe: string; providerId: string };
    };
  };
  return payload.data;
}

export type AssessmentDetailDto = {
  readonly id: string;
  readonly status: string;
  readonly titleHe?: string;
  readonly passingScore: number;
  readonly questions: readonly {
    readonly id: string;
    readonly promptHe: string;
    readonly options: readonly { readonly id: string; readonly labelHe: string }[];
  }[];
};

export async function fetchAssessmentDetail(
  assignmentId: string,
): Promise<AssessmentDetailDto> {
  const payload = (await authGet(`/v1/hr/assessments/${assignmentId}`)) as {
    data: AssessmentDetailDto;
  };
  return payload.data;
}

export async function submitAssessment(
  assignmentId: string,
  answers: Readonly<Record<string, string>>,
): Promise<{ readonly score: number; readonly passed: boolean }> {
  const payload = (await authPost(
    `/v1/hr/assessments/${assignmentId}/submit`,
    { answers },
  )) as { data: { score: number; passed: boolean } };
  return payload.data;
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
  legal(doc: "terms" | "cookies" | "security" | "privacy"): string {
    return `${APP_URLS.guest}/?doc=${doc}`;
  },
};
