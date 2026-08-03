import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { describe, it } from "node:test";
import {
  isUsableWebAuthnPublicKey,
  verifyWebAuthnAssertion,
} from "./webauthn-verify.js";

function buildAuthenticatorData(rpId: string, flags = 0x05): Buffer {
  const rpIdHash = createHash("sha256").update(rpId).digest();
  const counter = Buffer.alloc(4);
  return Buffer.concat([rpIdHash, Buffer.from([flags]), counter]);
}

describe("verifyWebAuthnAssertion", () => {
  it("accepts a valid ES256 assertion", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ec", {
      namedCurve: "P-256",
    });
    const jwk = publicKey.export({ format: "jwk" });
    const challenge = Buffer.from("challenge-bytes-32!!!!!!!!!!!!").toString(
      "base64url",
    );
    const clientData = Buffer.from(
      JSON.stringify({
        type: "webauthn.get",
        challenge,
        origin: "http://localhost:5173",
      }),
      "utf8",
    );
    const authenticatorData = buildAuthenticatorData("localhost");
    const clientDataHash = createHash("sha256").update(clientData).digest();
    const signed = Buffer.concat([authenticatorData, clientDataHash]);
    const signature = sign("SHA-256", signed, privateKey);

    const result = verifyWebAuthnAssertion({
      publicKeyJwkJson: JSON.stringify(jwk),
      clientDataJSON: clientData.toString("base64url"),
      authenticatorData: authenticatorData.toString("base64url"),
      signature: signature.toString("base64url"),
      expectedChallenge: challenge,
      expectedRpId: "localhost",
      allowedOrigins: ["http://localhost:5173"],
    });
    assert.deepEqual(result, { ok: true });
  });

  it("rejects tampered signatures", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ec", {
      namedCurve: "P-256",
    });
    const jwk = publicKey.export({ format: "jwk" });
    const challenge = "abc123challenge________________";
    const clientData = Buffer.from(
      JSON.stringify({
        type: "webauthn.get",
        challenge,
        origin: "http://localhost:5173",
      }),
      "utf8",
    );
    const authenticatorData = buildAuthenticatorData("localhost");
    const clientDataHash = createHash("sha256").update(clientData).digest();
    const signed = Buffer.concat([authenticatorData, clientDataHash]);
    const signature = sign("SHA-256", signed, privateKey);
    const last = signature.length - 1;
    signature[last] = (signature[last] ?? 0) ^ 0xff;

    const result = verifyWebAuthnAssertion({
      publicKeyJwkJson: JSON.stringify(jwk),
      clientDataJSON: clientData.toString("base64url"),
      authenticatorData: authenticatorData.toString("base64url"),
      signature: signature.toString("base64url"),
      expectedChallenge: challenge,
      expectedRpId: "localhost",
      allowedOrigins: ["http://localhost:5173"],
    });
    assert.equal(result.ok, false);
  });

  it("rejects incomplete public keys", () => {
    assert.equal(
      isUsableWebAuthnPublicKey(JSON.stringify({ kty: "EC", note: "x" })),
      false,
    );
  });
});
