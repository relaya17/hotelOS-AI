import { useEffect, useState, type FormEvent } from "react";
import { Button, TextField } from "@hotelos/ui";
import {
  createKashrutAnnotation,
  fetchKashrutAnnotations,
  listHotels,
  updateHotelKashrut,
  type HotelDto,
  type KashrutAnnotationDto,
  type KashrutStatus,
  type KashrutTargetKind,
} from "@hotelos/web-client";

const STATUS_LABEL: Record<KashrutStatus, string> = {
  ok: "תקין",
  note: "הערה",
  warn: "אזהרה",
  block: "חסימה",
};

const TARGET_KINDS: readonly KashrutTargetKind[] = [
  "procurement",
  "menu",
  "briefing",
  "event",
  "other",
];

export function KashrutPage() {
  const [hotels, setHotels] = useState<readonly HotelDto[]>([]);
  const [hotelId, setHotelId] = useState<string>("");
  const [enabled, setEnabled] = useState(false);
  const [annotations, setAnnotations] = useState<readonly KashrutAnnotationDto[]>(
    [],
  );
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [targetKind, setTargetKind] = useState<KashrutTargetKind>("menu");
  const [targetId, setTargetId] = useState("menu-demo-1");
  const [status, setStatus] = useState<KashrutStatus>("note");
  const [message, setMessage] = useState("");

  async function reload(selectedId: string) {
    const data = await fetchKashrutAnnotations(selectedId);
    setEnabled(data.kashrutEnabled);
    setAnnotations(data.annotations);
  }

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        const list = await listHotels();
        if (cancelled) return;
        setHotels(list);
        const first = list[0];
        if (!first) return;
        setHotelId(first.id);
        await reload(first.id);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "שגיאה בטעינה",
          );
        }
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onToggle() {
    if (!hotelId) return;
    setSaving(true);
    setError(undefined);
    try {
      const updated = await updateHotelKashrut(hotelId, !enabled);
      setEnabled(updated.kashrutEnabled);
      await reload(hotelId);
    } catch (toggleError) {
      setError(
        toggleError instanceof Error ? toggleError.message : "שגיאה בעדכון",
      );
    } finally {
      setSaving(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!hotelId) return;
    setSaving(true);
    setError(undefined);
    try {
      await createKashrutAnnotation(hotelId, {
        targetKind,
        targetId,
        status,
        ...(message.trim().length > 0 ? { message: message.trim() } : {}),
      });
      setMessage("");
      await reload(hotelId);
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "שגיאה בשמירה",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="kashrut" aria-labelledby="kashrut-title">
      <h1 id="kashrut-title">משגיח כשרות</h1>
      <p className="lead">
        הפעלה למלון והערות תמידיות (תקין / הערה / אזהרה / חסימה) — מחובר להנהלת
        F&B ו־CIO.
      </p>

      <label className="field">
        <span>מלון</span>
        <select
          value={hotelId}
          onChange={(event) => {
            const next = event.target.value;
            setHotelId(next);
            void reload(next).catch((loadError: unknown) => {
              setError(
                loadError instanceof Error ? loadError.message : "שגיאה",
              );
            });
          }}
        >
          {hotels.map((hotel) => (
            <option key={hotel.id} value={hotel.id}>
              {hotel.name}
              {hotel.kashrutEnabled ? " · כשרות פעילה" : ""}
            </option>
          ))}
        </select>
      </label>

      <div className="row">
        <Button type="button" onClick={() => void onToggle()} disabled={saving}>
          {enabled ? "כבה כשרות במלון" : "הפעל כשרות במלון"}
        </Button>
        <span className={enabled ? "badge badge--on" : "badge"}>
          {enabled ? "פעיל" : "כבוי"}
        </span>
      </div>

      {error ? (
        <p className="err" role="alert">
          {error}
        </p>
      ) : null}

      <form className="form" onSubmit={(event) => void onSubmit(event)}>
        <h2>הערה חדשה</h2>
        <label className="field">
          <span>סוג יעד</span>
          <select
            value={targetKind}
            onChange={(event) =>
              setTargetKind(event.target.value as KashrutTargetKind)
            }
            disabled={!enabled}
          >
            {TARGET_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
        </label>
        <TextField
          label="מזהה יעד"
          name="targetId"
          value={targetId}
          onChange={(event) => setTargetId(event.target.value)}
          disabled={!enabled}
          required
        />
        <label className="field">
          <span>סטטוס</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as KashrutStatus)}
            disabled={!enabled}
          >
            {(Object.keys(STATUS_LABEL) as KashrutStatus[]).map((key) => (
              <option key={key} value={key}>
                {STATUS_LABEL[key]}
              </option>
            ))}
          </select>
        </label>
        <TextField
          label="הודעת משגיח"
          name="message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          disabled={!enabled}
        />
        <Button type="submit" disabled={!enabled || saving}>
          שמור הערה
        </Button>
      </form>

      <h2>הערות אחרונות</h2>
      {annotations.length === 0 ? (
        <p className="muted">אין הערות עדיין.</p>
      ) : (
        <ul className="list">
          {annotations.map((item) => (
            <li key={item.id}>
              <strong>{STATUS_LABEL[item.status]}</strong> · {item.targetKind}/
              {item.targetId}
              {item.message ? ` — ${item.message}` : ""}
            </li>
          ))}
        </ul>
      )}

      <style>{`
        .kashrut{max-width:40rem;display:grid;gap:var(--space-4)}
        .lead{margin:0;color:rgb(16 36 31 / 72%)}
        .field{display:grid;gap:.35rem;font-weight:600}
        .field select{font:inherit;padding:.55rem .7rem;border-radius:var(--radius-sm);border:1px solid rgb(16 36 31 / 18%)}
        .row{display:flex;flex-wrap:wrap;gap:var(--space-3);align-items:center}
        .badge{padding:.25rem .6rem;border-radius:var(--radius-sm);background:rgb(16 36 31 / 8%);font-weight:700}
        .badge--on{background:var(--color-sea-deep);color:#fff}
        .form{display:grid;gap:var(--space-3);padding:var(--space-4);border:1px solid rgb(16 36 31 / 12%);border-radius:var(--radius-md)}
        .list{margin:0;padding-inline-start:1.2rem;display:grid;gap:.5rem}
        .err{color:#8b1e1e;font-weight:600}
        .muted{color:rgb(16 36 31 / 55%)}
      `}</style>
    </section>
  );
}
