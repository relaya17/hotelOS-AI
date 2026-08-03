import { useState, type FormEvent } from "react";
import { Button } from "@hotelos/ui";
import { submitGuestServiceRequest } from "@hotelos/web-client";

export type ServiceRequestFormProps = {
  readonly email: string;
  readonly bookingId: string;
  readonly onClose: () => void;
};

const SERVICE_TYPES: readonly {
  readonly value: "towels" | "cleaning" | "amenities";
  readonly label: string;
}[] = [
  { value: "towels", label: "מגבות נוספות" },
  { value: "cleaning", label: "ניקיון חדר" },
  { value: "amenities", label: "שירותי חדר" },
];

export function ServiceRequestForm({
  email,
  bookingId,
  onClose,
}: ServiceRequestFormProps) {
  const [serviceType, setServiceType] = useState<
    "towels" | "cleaning" | "amenities"
  >(SERVICE_TYPES[0]?.value ?? "towels");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    try {
      await submitGuestServiceRequest({
        email,
        bookingId,
        serviceType,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setSubmitted(true);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "שליחה נכשלה",
      );
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="service service--done" role="status">
        <p>הבקשה נקלטה. צוות המלון יטפל בה בהקדם.</p>
        <Button type="button" variant="ghost" onClick={onClose}>
          סגור
        </Button>
        <style>{`
          .service--done { padding:var(--space-4); border:1px solid rgb(15 106 92 / 20%); background:rgb(15 106 92 / 6%); border-radius:var(--radius-sm); display:grid; gap:var(--space-3); }
          .service--done p { margin:0; color:var(--color-ink-soft); }
        `}</style>
      </div>
    );
  }

  return (
    <form className="service" onSubmit={(e) => void onSubmit(e)} noValidate>
      <h3>בקשת שירות לחדר</h3>
      <label className="service__field">
        <span>סוג הבקשה</span>
        <select
          value={serviceType}
          onChange={(event) =>
            setServiceType(
              event.target.value as "towels" | "cleaning" | "amenities",
            )
          }
        >
          {SERVICE_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="service__field">
        <span>הערה (אופציונלי)</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          placeholder="פרטים נוספים לצוות..."
        />
      </label>
      {error ? (
        <p className="service__error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="service__actions">
        <Button type="submit" disabled={loading}>
          {loading ? "שולח…" : "שליחת בקשה"}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          ביטול
        </Button>
      </div>
      <style>{`
        .service { padding:var(--space-4); border:1px solid var(--color-line); background:var(--color-paper-elevated); border-radius:var(--radius-sm); display:grid; gap:var(--space-3); }
        .service h3 { margin:0; font-family:var(--font-display); font-size:1.05rem; }
        .service__field { display:grid; gap:var(--space-2); }
        .service__field span { font-size:var(--text-small); font-weight:600; color:var(--color-ink-soft); }
        .service__field select, .service__field textarea { font:inherit; border:1px solid var(--color-line-strong); border-radius:var(--radius-sm); padding:.75rem .85rem; background:#fff; }
        .service__field textarea { resize:vertical; }
        .service__error { margin:0; color:var(--color-danger); font-size:var(--text-small); }
        .service__actions { display:flex; flex-wrap:wrap; gap:var(--space-2); }
      `}</style>
    </form>
  );
}
