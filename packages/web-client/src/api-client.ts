import { clearSession, readAccessToken } from "./session.js";

// import.meta.env is only populated inside Vite builds (all three frontend
// apps). Falls back to the local dev API port when unset, so this keeps
// working unchanged in tests / non-Vite consumers.
const viteEnv: Record<string, string | undefined> =
  (import.meta as unknown as { env?: Record<string, string | undefined> })
    .env ?? {};

const API_BASE = viteEnv["VITE_API_BASE"] ?? "http://localhost:3001";

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

async function authPost(path: string, body?: unknown): Promise<unknown> {
  const token = readAccessToken();
  if (!token) {
    throw new Error("Missing session");
  }
  const init: RequestInit = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  const response = await fetch(`${API_BASE}${path}`, init);
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
    `${API_BASE}/v1/briefing-rooms/${roomId}/recordings/${recordingId}/complete`,
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
  return `${API_BASE}/v1/briefing-rooms/${roomId}/recordings/${recordingId}/media`;
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
  const response = await fetch(`${API_BASE}/v1/public/legal`);
  const payload = (await parseJson(response)) as { data: LegalDocSummary[] };
  if (!response.ok) throw new Error("Failed to load legal index");
  return payload.data;
}

export async function fetchLegalDocument(id: string): Promise<LegalDocDetail> {
  const response = await fetch(`${API_BASE}/v1/public/legal/${id}`);
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
  const response = await fetch(`${API_BASE}/v1/trust/cookies/consent`, {
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
  const response = await fetch(`${API_BASE}/v1/trust/oauth/google/demo`, {
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

const guestAppUrl = viteEnv["VITE_APP_URL_GUEST"] ?? "http://localhost:5175";

export const APP_URLS = {
  executive: viteEnv["VITE_APP_URL_EXECUTIVE"] ?? "http://localhost:5173",
  admin: viteEnv["VITE_APP_URL_ADMIN"] ?? "http://localhost:5174",
  guest: guestAppUrl,
  legal: (doc: "terms" | "cookies" | "security" | "privacy") =>
    `${guestAppUrl}/?doc=${doc}`,
} as const;
