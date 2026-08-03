import { createHash, createPublicKey, verify } from "node:crypto";
import { isOriginAllowed } from "@hotelos/config";

export type WebAuthnVerifyInput = {
  readonly publicKeyJwkJson: string;
  /** base64url */
  readonly clientDataJSON: string;
  /** base64url */
  readonly authenticatorData: string;
  /** base64url DER ECDSA signature */
  readonly signature: string;
  /** Server challenge (base64url), must match clientData.challenge */
  readonly expectedChallenge: string;
  readonly expectedRpId: string;
  readonly allowedOrigins: readonly string[];
  readonly requireUserVerification?: boolean;
};

export type WebAuthnVerifyResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

type ClientData = {
  readonly type?: string;
  readonly challenge?: string;
  readonly origin?: string;
};

type EcJwk = {
  readonly kty?: string;
  readonly crv?: string;
  readonly x?: string;
  readonly y?: string;
};

/**
 * Verify a WebAuthn assertion for an ES256 (P-256) credential stored as JWK.
 */
export function verifyWebAuthnAssertion(
  input: WebAuthnVerifyInput,
): WebAuthnVerifyResult {
  let clientData: ClientData;
  try {
    clientData = JSON.parse(
      Buffer.from(input.clientDataJSON, "base64url").toString("utf8"),
    ) as ClientData;
  } catch {
    return { ok: false, reason: "Invalid clientDataJSON" };
  }

  if (clientData.type !== "webauthn.get") {
    return { ok: false, reason: "Invalid clientData type" };
  }
  if (clientData.challenge !== input.expectedChallenge) {
    return { ok: false, reason: "Challenge mismatch" };
  }
  if (!clientData.origin || !isOriginAllowed(clientData.origin, input.allowedOrigins)) {
    return { ok: false, reason: "Origin not allowed" };
  }

  const authData = Buffer.from(input.authenticatorData, "base64url");
  if (authData.length < 37) {
    return { ok: false, reason: "AuthenticatorData too short" };
  }

  const rpIdHash = authData.subarray(0, 32);
  const expectedRpHash = createHash("sha256").update(input.expectedRpId).digest();
  if (!rpIdHash.equals(expectedRpHash)) {
    return { ok: false, reason: "RP ID hash mismatch" };
  }

  const flags = authData[32]!;
  if ((flags & 0x01) === 0) {
    return { ok: false, reason: "User presence required" };
  }
  if (input.requireUserVerification !== false && (flags & 0x04) === 0) {
    return { ok: false, reason: "User verification required" };
  }

  let jwk: EcJwk;
  try {
    jwk = JSON.parse(input.publicKeyJwkJson) as EcJwk;
  } catch {
    return { ok: false, reason: "Invalid public key JSON" };
  }
  if (jwk.kty !== "EC" || jwk.crv !== "P-256" || !jwk.x || !jwk.y) {
    return { ok: false, reason: "Unsupported or incomplete public key" };
  }

  const clientDataHash = createHash("sha256")
    .update(Buffer.from(input.clientDataJSON, "base64url"))
    .digest();
  const signed = Buffer.concat([authData, clientDataHash]);
  const signature = Buffer.from(input.signature, "base64url");

  try {
    const key = createPublicKey({
      key: jwk,
      format: "jwk",
    });
    const valid = verify("SHA-256", signed, key, signature);
    if (!valid) {
      return { ok: false, reason: "Signature invalid" };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "Signature verification failed" };
  }
}

export function isUsableWebAuthnPublicKey(publicKeyJwkJson: string): boolean {
  try {
    const jwk = JSON.parse(publicKeyJwkJson) as EcJwk;
    return jwk.kty === "EC" && jwk.crv === "P-256" && Boolean(jwk.x && jwk.y);
  } catch {
    return false;
  }
}
