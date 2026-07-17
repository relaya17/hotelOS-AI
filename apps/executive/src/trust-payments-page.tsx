import { useEffect, useState } from "react";
import { Button, TextField, SignaturePad } from "@hotelos/ui";
import {
  confirmPaymentIntent,
  createDigitalSignature,
  createPaymentIntent,
  createWebAuthnChallenge,
  listPayments,
  registerWebAuthnCredential,
} from "@hotelos/web-client";

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function TrustPaymentsPage() {
  const [amount, setAmount] = useState("15000");
  const [description, setDescription] = useState("שהייה / פיקדון");
  const [payments, setPayments] = useState<
    readonly {
      readonly id: string;
      readonly amountMinor: number;
      readonly currency: string;
      readonly status: string;
      readonly description: string;
      readonly createdAt: string;
    }[]
  >([]);
  const [signature, setSignature] = useState<string | null>(null);
  const [message, setMessage] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  async function reload() {
    setPayments(await listPayments());
  }

  useEffect(() => {
    void reload().catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : "Load failed");
    });
  }, []);

  async function onPay() {
    setError(undefined);
    setMessage(undefined);
    try {
      const amountMinor = Number(amount);
      if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
        throw new Error("סכום לא תקין");
      }
      const intent = await createPaymentIntent({
        amountMinor,
        currency: "ILS",
        description,
      });
      if (signature) {
        await createDigitalSignature({
          subjectType: "payment",
          subjectId: intent.id,
          signerName: "Payer",
          purpose: "אישור תשלום",
          imageDataUrl: signature,
        });
      }
      const confirmed = await confirmPaymentIntent(intent.id);
      setMessage(`תשלום ${confirmed.id.slice(0, 8)} · ${confirmed.status}`);
      await reload();
    } catch (payError) {
      setError(payError instanceof Error ? payError.message : "Payment failed");
    }
  }

  async function onRegisterBiometric() {
    setError(undefined);
    setMessage(undefined);
    try {
      if (!window.PublicKeyCredential) {
        throw new Error("המכשיר לא תומך ב־WebAuthn");
      }
      const challenge = await createWebAuthnChallenge("register");
      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge: Uint8Array.from(atob(challenge.challenge.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
            c.charCodeAt(0),
          ),
          rp: { name: challenge.rp.name, id: challenge.rp.id },
          user: {
            id: crypto.getRandomValues(new Uint8Array(16)),
            name: "staff@hotelos.local",
            displayName: "HotelOS Staff",
          },
          pubKeyCredParams: [{ alg: -7, type: "public-key" }],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
          },
          timeout: 60_000,
        },
      })) as PublicKeyCredential | null;
      if (!credential) throw new Error("ביטול הרשמה ביומטרית");
      const response = credential.response as AuthenticatorAttestationResponse;
      const publicKey = response.getPublicKey?.();
      const publicKeyJwkJson = publicKey
        ? JSON.stringify(
            await crypto.subtle.exportKey(
              "jwk",
              await crypto.subtle.importKey(
                "spki",
                publicKey,
                { name: "ECDSA", namedCurve: "P-256" },
                true,
                ["verify"],
              ),
            ),
          )
        : JSON.stringify({ kty: "EC", note: "platform-credential" });

      await registerWebAuthnCredential({
        credentialId: bufferToBase64Url(credential.rawId),
        publicKeyJwkJson,
        challenge: challenge.challenge,
        deviceLabel: "fingerprint/platform",
      });
      setMessage("ביומטריה (אצבע/פנים) נרשמה למכשיר זה");
    } catch (bioError) {
      setError(
        bioError instanceof Error ? bioError.message : "Biometric failed",
      );
    }
  }

  return (
    <div className="page">
      <header>
        <p className="eyebrow">Trust · Payments & biometrics</p>
        <h1>תשלומים וחתימה דיגיטלית</h1>
        <p className="sub">
          מערכת תשלומים פנימית + חתימה + רישום WebAuthn לאימות אצבע/פנים.
        </p>
      </header>

      <section className="card">
        <TextField
          label="סכום (אגורות)"
          name="amount"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        <TextField
          label="תיאור"
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <SignaturePad onChange={setSignature} />
        <div className="actions">
          <Button type="button" onClick={() => void onPay()}>
            צור ואשר תשלום
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => void onRegisterBiometric()}
          >
            רשום אצבע / פנים
          </Button>
        </div>
        {error !== undefined ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}
        {message !== undefined ? <p className="ok">{message}</p> : null}
      </section>

      <section className="card">
        <h2>תשלומים אחרונים</h2>
        <ul>
          {payments.map((payment) => (
            <li key={payment.id}>
              <strong>
                {payment.status} · {(payment.amountMinor / 100).toFixed(2)}{" "}
                {payment.currency}
              </strong>
              <span>
                {payment.description} ·{" "}
                {new Date(payment.createdAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <style>{`
        .page{display:grid;gap:var(--space-4)}
        .eyebrow{margin:0 0 var(--space-2);letter-spacing:.08em;text-transform:uppercase;font-size:var(--text-small);color:var(--color-sea-deep);font-weight:700}
        h1{margin:0;font-size:clamp(1.8rem,3vw,2.6rem)}
        .sub{margin:var(--space-2) 0 0;color:var(--color-ink-soft)}
        .card{background:rgb(255 250 242 / 92%);border:1px solid rgb(16 36 31 / 10%);border-radius:var(--radius-md);padding:var(--space-4);display:grid;gap:var(--space-3);box-shadow:var(--shadow-soft)}
        .actions{display:flex;gap:var(--space-2);flex-wrap:wrap}
        ul{list-style:none;margin:0;padding:0;display:grid;gap:var(--space-2)}
        li{display:grid;gap:.2rem;padding:var(--space-3);border-radius:var(--radius-sm);background:var(--color-paper-elevated)}
        li span{font-size:var(--text-small);color:var(--color-ink-soft)}
        .err{color:var(--color-danger);margin:0}
        .ok{color:var(--color-sea-deep);margin:0;font-weight:600}
      `}</style>
    </div>
  );
}
