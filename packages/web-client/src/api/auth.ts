import {
  clearSession,
  readRefreshToken,
  saveSession,
  type StoredUser,
} from "../session.js";
import {
  authGet,
  authPost,
  getApiBase,
  parseJson,
  toErrorMessage,
} from "./core.js";

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

function base64UrlToBuffer(value: string): ArrayBuffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
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
  authenticatorData: string;
  signature: string;
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
    authenticatorData: bufferToBase64Url(response.authenticatorData),
    signature: bufferToBase64Url(response.signature),
  });
}

export async function assertWebAuthnForSession(): Promise<{
  readonly credentialId: string;
  readonly challenge: string;
  readonly clientDataJSON: string;
  readonly authenticatorData: string;
  readonly signature: string;
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
    const response = credential.response as AuthenticatorAssertionResponse;
    return {
      credentialId: bufferToBase64Url(credential.rawId),
      challenge: challenge.challenge,
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      authenticatorData: bufferToBase64Url(response.authenticatorData),
      signature: bufferToBase64Url(response.signature),
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
  webauthnClientDataJSON?: string;
  webauthnAuthenticatorData?: string;
  webauthnSignature?: string;
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
