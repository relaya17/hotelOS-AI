import {
  loginWithGoogleDemo,
  loginWithWebAuthn,
  startGoogleOAuth,
  type LoginResponse,
} from "@hotelos/web-client";

export async function staffGoogleLogin(input: {
  tenantId: string;
  email: string;
}): Promise<LoginResponse | "redirecting"> {
  const start = await startGoogleOAuth(input.tenantId);
  if (start.mode === "oauth") {
    window.location.assign(start.url);
    return "redirecting";
  }
  return loginWithGoogleDemo(input);
}

export async function staffWebAuthnLogin(input: {
  tenantId: string;
  email: string;
}): Promise<LoginResponse> {
  return loginWithWebAuthn(input);
}
