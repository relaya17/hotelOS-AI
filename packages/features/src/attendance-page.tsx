import { useEffect, useState } from "react";
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

export function AttendancePage() {
  const [employees, setEmployees] = useState<readonly EmployeeDto[]>([]);
  const [hotels, setHotels] = useState<readonly HotelDto[]>([]);
  const [events, setEvents] = useState<readonly AttendanceEventDto[]>([]);
  const [employeeId, setEmployeeId] = useState(DEMO_EMPLOYEE);
  const [hotelId, setHotelId] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | undefined>();

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
      setError(loadError instanceof Error ? loadError.message : "Load failed");
    });
  }, []);

  async function captureVoiceSample(): Promise<string | undefined> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
      await new Promise((r) => setTimeout(r, 1800));
      recorder.stop();
      return await done;
    } catch {
      return undefined;
    }
  }

  async function onClock(eventType: "clock_in" | "clock_out") {
    if (!hotelId) {
      setError("בחרו מלון");
      return;
    }
    setBusy(true);
    setError(undefined);
    setLastMessage(undefined);
    try {
      let signatureId: string | undefined;
      if (signatureDataUrl) {
        const signature = await createDigitalSignature({
          subjectType: "attendance",
          subjectId: employeeId,
          signerName: "Employee",
          purpose: eventType === "clock_in" ? "כניסה למשמרת" : "יציאה ממשמרת",
          imageDataUrl: signatureDataUrl,
        });
        signatureId = signature.id;
      }

      const voiceSampleBase64 = await captureVoiceSample();
      if (voiceSampleBase64 && eventType === "clock_in") {
        await enrollVoiceSample({ sampleBase64: voiceSampleBase64 }).catch(
          () => undefined,
        );
      }

      let latitude: number | undefined;
      let longitude: number | undefined;
      let accuracyMeters: number | undefined;
      try {
        const position = await new Promise<GeolocationPosition>(
          (resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 8000,
            });
          },
        );
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
        accuracyMeters = position.coords.accuracy;
      } catch {
        // geo optional on desktop
      }

      const webauthn = await assertWebAuthnForSession();

      const result = await clockAttendance({
        employeeId,
        hotelId,
        eventType,
        deviceLabel: /Mobi|Android/i.test(navigator.userAgent)
          ? "phone"
          : "desktop",
        ...(signatureId !== undefined ? { signatureId } : {}),
        ...(voiceSampleBase64 !== undefined ? { voiceSampleBase64 } : {}),
        ...(latitude !== undefined ? { latitude } : {}),
        ...(longitude !== undefined ? { longitude } : {}),
        ...(accuracyMeters !== undefined ? { accuracyMeters } : {}),
        ...(webauthn
          ? {
              webauthnCredentialId: webauthn.credentialId,
              webauthnChallenge: webauthn.challenge,
            }
          : {}),
      });

      setLastMessage(
        `${eventType === "clock_in" ? "כניסה" : "יציאה"} נרשמה · voice=${String(result.voiceVerified)} · biometric=${String(result.webauthnVerified)} · geo=${result.latitude !== null ? "yes" : "no"}`,
      );
      await reload();
    } catch (clockError) {
      setError(
        clockError instanceof Error ? clockError.message : "Clock failed",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header>
        <p className="eyebrow">Workforce · Mobile attendance</p>
        <h1>שעון נוכחות</h1>
        <p className="sub">
          כניסה/יציאה מהטלפון עם מיקום, חתימה דיגיטלית ואימות קולי — מעקב לכל
          עובד בהפרדת tenant.
        </p>
      </header>

      <section className="card">
        <label className="field">
          <span>עובד</span>
          <select
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
          >
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.displayName} · {employee.roleLabel} ·{" "}
                {employee.preferredLocale}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>מלון</span>
          <select
            value={hotelId}
            onChange={(event) => setHotelId(event.target.value)}
          >
            {hotels.map((hotel) => (
              <option key={hotel.id} value={hotel.id}>
                {hotel.name}
              </option>
            ))}
          </select>
        </label>
        <SignaturePad onChange={setSignatureDataUrl} />
        <div className="actions">
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
        {error !== undefined ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}
        {lastMessage !== undefined ? <p className="ok">{lastMessage}</p> : null}
      </section>

      <section className="card">
        <h2>יומן נוכחות</h2>
        <ul>
          {events.map((event) => (
            <li key={event.id}>
              <strong>
                {event.eventType} ·{" "}
                {new Date(event.occurredAt).toLocaleString()}
              </strong>
              <span>
                {event.deviceLabel}
                {event.latitude !== null
                  ? ` · ${event.latitude.toFixed(4)},${event.longitude?.toFixed(4)}`
                  : ""}
                {event.voiceVerified ? " · voice✓" : ""}
                {event.webauthnVerified ? " · biometric✓" : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <style>{`
        .page{display:grid;gap:var(--space-4)}
        .eyebrow{margin:0 0 var(--space-2);letter-spacing:.08em;text-transform:uppercase;font-size:var(--text-small);color:var(--color-sea-deep);font-weight:700}
        h1{margin:0;font-size:clamp(1.8rem,3vw,2.6rem)}
        .sub{margin:var(--space-2) 0 0;color:var(--color-ink-soft);max-width:60ch}
        .card{background:rgb(255 250 242 / 92%);border:1px solid rgb(16 36 31 / 10%);border-radius:var(--radius-md);padding:var(--space-4);display:grid;gap:var(--space-3);box-shadow:var(--shadow-soft)}
        .field{display:grid;gap:var(--space-2)}
        .field span{font-size:var(--text-small);font-weight:600;color:var(--color-ink-soft)}
        select{font:inherit;border:1px solid rgb(16 36 31 / 18%);border-radius:var(--radius-sm);padding:.85rem .95rem;background:var(--color-paper-elevated)}
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
