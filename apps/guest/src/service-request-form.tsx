import { useState, type FormEvent } from "react";
import { Button } from "@hotelos/ui";

export type ServiceRequestFormProps = {
  readonly onClose: () => void;
};

const SERVICE_TYPES: readonly {
  readonly value: string;
  readonly label: string;
}[] = [
  { value: "towels", label: "מגבות נוספות" },
  { value: "cleaning", label: "ניקיון חדר" },
  { value: "amenities", label: "שירותי חדר / amenities" },
];

export function ServiceRequestForm({ onClose }: ServiceRequestFormProps) {
  const [serviceType, setServiceType] = useState(SERVICE_TYPES[0]?.value ?? "towels");
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
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
    <form className="service" onSubmit={onSubmit} noValidate>
      <h3>בקשת שירות לחדר</h3>
      <label className="service__field">
        <span>סוג הבקשה</span>
        <select
          value={serviceType}
          onChange={(event) => setServiceType(event.target.value)}
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
      <div className="service__actions">
        <Button type="submit">שליחת בקשה</Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          ביטול
        </Button>
      </div>
      <style>{`
        .service { padding:var(--space-4); border:1px solid rgb(16 36 31 / 10%); background:var(--color-paper-elevated); border-radius:var(--radius-sm); display:grid; gap:var(--space-3); }
        .service h3 { margin:0; font-family:var(--font-display); font-size:1.05rem; }
        .service__field { display:grid; gap:var(--space-2); }
        .service__field span { font-size:var(--text-small); font-weight:600; color:var(--color-ink-soft); }
        .service__field select, .service__field textarea { font:inherit; border:1px solid rgb(16 36 31 / 18%); border-radius:var(--radius-sm); padding:.75rem .85rem; background:#fff; }
        .service__field textarea { resize:vertical; }
        .service__actions { display:flex; flex-wrap:wrap; gap:var(--space-2); }
      `}</style>
    </form>
  );
}
