import { useEffect, useMemo, useState } from "react";
import { Button, SignaturePad } from "@hotelos/ui";
import {
  assertWebAuthnForSession,
  clockAttendance,
  createDigitalSignature,
  enrollVoiceSample,
  listAttendance,
  listEmployees,
  listHotels,
  type AttendanceEventDto,
  type EmployeeDto,
  type HotelDto,
} from "@hotelos/web-client";

const DEMO_EMPLOYEE = "e1000000-0000-4000-8000-000000000001";

const GEO_TIMEOUT_MS = 4000;
const VOICE_MEDIA_TIMEOUT_MS = 2500;
const VOICE_RECORD_MS = 1800;

type ClockPhase =
  | "geo"
  | "voice"
  | "signature"
  | "biometric"
  | "saving";

type ClockResult = {
  readonly eventType: "clock_in" | "clock_out";
  readonly occurredAt: string;
  readonly geo: boolean;
  readonly voice: boolean;
  readonly biometric: boolean;
};

function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatEventLabel(eventType: string): string {
  return eventType === "clock_in" ? "כניסה למשמרת" : "יציאה ממשמרת";
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T | undefined> {
  return Promise.race([
    promise,
    new Promise<undefined>((resolve) => {
      window.setTimeout(() => resolve(undefined), timeoutMs);
    }),
  ]);
}

async function captureGeolocation(): Promise<{
  latitude: number;
  longitude: number;
  accuracyMeters: number;
} | undefined> {
  if (!navigator.geolocation) return undefined;
  try {
    const position = await withTimeout(
      new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: GEO_TIMEOUT_MS,
          maximumAge: 30_000,
        });
      }),
      GEO_TIMEOUT_MS,
    );
    if (!position) return undefined;
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracyMeters: position.coords.accuracy,
    };
  } catch {
    return undefined;
  }
}

async function captureVoiceSample(): Promise<string | undefined> {
  if (!navigator.mediaDevices?.getUserMedia) return undefined;
  try {
    const stream = await withTimeout(
      navigator.mediaDevices.getUserMedia({ audio: true }),
      VOICE_MEDIA_TIMEOUT_MS,
    );
    if (!stream) return undefined;

    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    const done = new Promise<string>((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => reject(new Error("Voice capture failed"));
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result;
          if (typeof result !== "string") {
            reject(new Error("Voice encode failed"));
            return;
          }
          const base64 = result.split(",")[1] ?? "";
          resolve(base64);
        };
        reader.readAsDataURL(blob);
      };
    });
    recorder.start();
    await new Promise((resolve) => window.setTimeout(resolve, VOICE_RECORD_MS));
    recorder.stop();
    return await done;
  } catch {
    return undefined;
  }
}

function VerificationChips(props: {
  readonly geo: boolean;
  readonly voice: boolean;
  readonly biometric: boolean;
}) {
  return (
    <span className="chips" aria-label="אימותים">
      <span className={props.geo ? "chip chip--on" : "chip"}>מיקום{props.geo ? " ✓" : ""}</span>
      <span className={props.voice ? "chip chip--on" : "chip"}>קול{props.voice ? " ✓" : ""}</span>
      <span className={props.biometric ? "chip chip--on" : "chip"}>
        ביומטריה{props.biometric ? " ✓" : ""}
      </span>
    </span>
  );
}

function phaseLabel(phase: ClockPhase): string {
  switch (phase) {
    case "geo":
      return "מבקש מיקום…";
    case "voice":
      return "מקליט קול קצר…";
    case "signature":
      return "שומר חתימה…";
    case "biometric":
      return "מאמת ביומטריה…";
    case "saving":
      return "שומר…";
  }
}

export function AttendancePage() {
  const [employees, setEmployees] = useState<readonly EmployeeDto[]>([]);
  const [hotels, setHotels] = useState<readonly HotelDto[]>([]);
  const [events, setEvents] = useState<readonly AttendanceEventDto[]>([]);
  const [employeeId, setEmployeeId] = useState(DEMO_EMPLOYEE);
  const [hotelId, setHotelId] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [showSignature, setShowSignature] = useState(false);
  const [fastMode, setFastMode] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [clockPhase, setClockPhase] = useState<ClockPhase | undefined>();
  const [lastResult, setLastResult] = useState<ClockResult | undefined>();

  const latestEvent = useMemo(() => events[0], [events]);

  async function reload() {
    const [emps, hotelList, attendance] = await Promise.all([
      listEmployees(),
      listHotels(),
      listAttendance(),
    ]);
    setEmployees(emps);
    setHotels(hotelList);
    setEvents(attendance);
    if (!hotelId && hotelList[0]) setHotelId(hotelList[0].id);
  }

  useEffect(() => {
    void reload().catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : "טעינה נכשלה");
    });
  }, []);

  async function onClock(eventType: "clock_in" | "clock_out") {
    if (!hotelId) {
      setError("בחרו מלון");
      return;
    }
    setBusy(true);
    setError(undefined);
    setLastResult(undefined);
    setClockPhase(undefined);

    try {
      setClockPhase("geo");
      const geo = await captureGeolocation();

      let voiceSampleBase64: string | undefined;
      if (!fastMode) {
        setClockPhase("voice");
        voiceSampleBase64 = await captureVoiceSample();
        if (voiceSampleBase64 && eventType === "clock_in") {
          await enrollVoiceSample({ sampleBase64: voiceSampleBase64 }).catch(
            () => undefined,
          );
        }
      }

      let signatureId: string | undefined;
      if (!fastMode && signatureDataUrl) {
        setClockPhase("signature");
        const signature = await createDigitalSignature({
          subjectType: "attendance",
          subjectId: employeeId,
          signerName: "Employee",
          purpose: eventType === "clock_in" ? "כניסה למשמרת" : "יציאה ממשמרת",
          imageDataUrl: signatureDataUrl,
        });
        signatureId = signature.id;
      }

      let webauthn: { credentialId: string; challenge: string } | null = null;
      if (!fastMode) {
        setClockPhase("biometric");
        webauthn = await assertWebAuthnForSession();
      }

      setClockPhase("saving");
      const result = await clockAttendance({
        employeeId,
        hotelId,
        eventType,
        deviceLabel: /Mobi|Android/i.test(navigator.userAgent)
          ? "phone"
          : "desktop",
        ...(signatureId !== undefined ? { signatureId } : {}),
        ...(voiceSampleBase64 !== undefined ? { voiceSampleBase64 } : {}),
        ...(geo !== undefined
          ? {
              latitude: geo.latitude,
              longitude: geo.longitude,
              accuracyMeters: geo.accuracyMeters,
            }
          : {}),
        ...(webauthn
          ? {
              webauthnCredentialId: webauthn.credentialId,
              webauthnChallenge: webauthn.challenge,
            }
          : {}),
      });

      setLastResult({
        eventType,
        occurredAt: result.occurredAt,
        geo: result.latitude !== null || geo !== undefined,
        voice: result.voiceVerified,
        biometric: result.webauthnVerified,
      });
      await reload();
    } catch (clockError) {
      setError(
        clockError instanceof Error ? clockError.message : "רישום נכשל",
      );
    } finally {
      setBusy(false);
      setClockPhase(undefined);
    }
  }

  return (
    <div className="page">
      <header>
        <p className="eyebrow">כוח אדם · נוכחות מהטלפון</p>
        <h1>שעון משמרת</h1>
        <p className="sub">
          כניסה ויציאה בלחיצה אחת — מיקום, קול וחתימה רק כשצריך.
        </p>
      </header>

      {latestEvent ? (
        <section className="hero card" aria-label="רישום אחרון">
          <p className="hero-label">רישום אחרון</p>
          <p className="hero-title">
            {formatEventLabel(latestEvent.eventType)} ·{" "}
            {formatClockTime(latestEvent.occurredAt)}
          </p>
          <VerificationChips
            geo={latestEvent.latitude !== null}
            voice={latestEvent.voiceVerified}
            biometric={latestEvent.webauthnVerified}
          />
        </section>
      ) : null}

      <section className="card clock-card">
        <label className="field">
          <span>עובד</span>
          <select
            value={employeeId}
            disabled={busy}
            onChange={(event) => setEmployeeId(event.target.value)}
          >
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.displayName} · {employee.roleLabel}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>מלון</span>
          <select
            value={hotelId}
            disabled={busy}
            onChange={(event) => setHotelId(event.target.value)}
          >
            {hotels.map((hotel) => (
              <option key={hotel.id} value={hotel.id}>
                {hotel.name}
              </option>
            ))}
          </select>
        </label>

        <label className="toggle">
          <input
            type="checkbox"
            checked={fastMode}
            disabled={busy}
            onChange={(event) => {
              setFastMode(event.target.checked);
              if (event.target.checked) setShowSignature(false);
            }}
          />
          <span>מצב מהיר — ללא קול וחתימה</span>
        </label>

        {!fastMode ? (
          <div className="optional">
            <button
              type="button"
              className="optional-toggle"
              disabled={busy}
              aria-expanded={showSignature}
              onClick={() => setShowSignature((open) => !open)}
            >
              {showSignature ? "הסתר חתימה" : "הוסף חתימה (אופציונלי)"}
            </button>
            {showSignature ? (
              <SignaturePad onChange={setSignatureDataUrl} />
            ) : null}
          </div>
        ) : null}

        <div className="clock-actions">
          <Button
            type="button"
            disabled={busy}
            onClick={() => {
              void onClock("clock_in");
            }}
          >
            כניסה למשמרת
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              void onClock("clock_out");
            }}
          >
            יציאה ממשמרת
          </Button>
        </div>

        {busy && clockPhase !== undefined ? (
          <p className="status" role="status" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            {phaseLabel(clockPhase)}
          </p>
        ) : null}

        {error !== undefined ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}

        {lastResult !== undefined ? (
          <div className="ok" role="status">
            <p className="ok-title">
              {lastResult.eventType === "clock_in"
                ? `נכנסת למשמרת · ${formatClockTime(lastResult.occurredAt)}`
                : "יצאת ממשמרת"}
            </p>
            <VerificationChips
              geo={lastResult.geo}
              voice={lastResult.voice}
              biometric={lastResult.biometric}
            />
          </div>
        ) : null}
      </section>

      <section className="card">
        <h2>יומן נוכחות</h2>
        <ul>
          {events.map((event, index) => (
            <li
              key={event.id}
              className={index === 0 ? "journal-item journal-item--latest" : "journal-item"}
            >
              <strong>
                {formatEventLabel(event.eventType)} ·{" "}
                {formatClockTime(event.occurredAt)}
              </strong>
              <span className="journal-meta">
                {new Date(event.occurredAt).toLocaleDateString("he-IL")}
                {event.deviceLabel === "phone" ? " · טלפון" : " · מחשב"}
              </span>
              <VerificationChips
                geo={event.latitude !== null}
                voice={event.voiceVerified}
                biometric={event.webauthnVerified}
              />
            </li>
          ))}
        </ul>
      </section>

      <style>{`
        .page{display:grid;gap:var(--space-4);max-width:36rem;margin:0 auto}
        .eyebrow{margin:0 0 var(--space-2);letter-spacing:.08em;text-transform:uppercase;font-size:var(--text-small);color:var(--color-sea-deep);font-weight:700}
        h1{margin:0;font-size:clamp(1.8rem,6vw,2.4rem)}
        h2{margin:0;font-size:1.15rem}
        .sub{margin:var(--space-2) 0 0;color:var(--color-ink-soft);max-width:40ch;line-height:1.5}
        .card{background:rgb(255 250 242 / 92%);border:1px solid rgb(16 36 31 / 10%);border-radius:var(--radius-md);padding:var(--space-4);display:grid;gap:var(--space-3);box-shadow:var(--shadow-soft)}
        .hero{background:linear-gradient(145deg,rgb(230 245 240 / 95%),rgb(255 250 242 / 98%));border-color:rgb(16 36 31 / 14%)}
        .hero-label{margin:0;font-size:var(--text-small);font-weight:600;color:var(--color-ink-soft)}
        .hero-title{margin:0;font-size:1.35rem;font-weight:700;color:var(--color-sea-deep)}
        .field{display:grid;gap:var(--space-2)}
        .field span{font-size:var(--text-small);font-weight:600;color:var(--color-ink-soft)}
        select{font:inherit;border:1px solid rgb(16 36 31 / 18%);border-radius:var(--radius-sm);padding:.85rem .95rem;background:var(--color-paper-elevated);min-height:2.75rem}
        .toggle{display:flex;align-items:center;gap:var(--space-2);font-size:var(--text-small);color:var(--color-ink-soft);cursor:pointer}
        .toggle input{width:1.1rem;height:1.1rem;accent-color:var(--color-sea-deep)}
        .optional{display:grid;gap:var(--space-2)}
        .optional-toggle{font:inherit;background:none;border:none;padding:0;text-align:start;color:var(--color-sea-deep);font-weight:600;text-decoration:underline;cursor:pointer;min-height:2.75rem}
        .optional-toggle:disabled{opacity:.5;cursor:not-allowed}
        .clock-actions{display:grid;gap:var(--space-2)}
        .clock-actions .hotelos-button{width:100%;min-height:3.25rem;font-size:1.05rem;font-weight:700}
        .clock-actions .hotelos-button--primary{min-height:3.75rem;font-size:1.15rem}
        .status{display:flex;align-items:center;gap:var(--space-2);margin:0;color:var(--color-sea-deep);font-weight:600}
        .spinner{width:1rem;height:1rem;border:2px solid rgb(16 36 31 / 15%);border-top-color:var(--color-sea-deep);border-radius:50%;animation:spin .8s linear infinite;flex-shrink:0}
        @keyframes spin{to{transform:rotate(360deg)}}
        ul{list-style:none;margin:0;padding:0;display:grid;gap:var(--space-2)}
        .journal-item{display:grid;gap:var(--space-2);padding:var(--space-3);border-radius:var(--radius-sm);background:var(--color-paper-elevated)}
        .journal-item--latest{border:1px solid rgb(16 36 31 / 12%);background:rgb(255 252 247 / 98%)}
        .journal-meta{font-size:var(--text-small);color:var(--color-ink-soft)}
        .chips{display:flex;flex-wrap:wrap;gap:.35rem}
        .chip{font-size:.75rem;padding:.2rem .55rem;border-radius:999px;background:rgb(16 36 31 / 6%);color:var(--color-ink-soft)}
        .chip--on{background:rgb(16 80 60 / 12%);color:var(--color-sea-deep);font-weight:600}
        .err{color:var(--color-danger);margin:0}
        .ok{display:grid;gap:var(--space-2);padding:var(--space-3);border-radius:var(--radius-sm);background:rgb(230 245 240 / 55%)}
        .ok-title{margin:0;color:var(--color-sea-deep);font-weight:700;font-size:1.05rem}
      `}</style>
    </div>
  );
}
