import { useState, type FormEvent } from "react";
import { submitLead } from "@hotelos/web-client";
import { CALENDLY_URL, PILOT_MAIL } from "./constants.js";

export function ContactLeadForm() {
  const [name, setName] = useState("");
  const [hotel, setHotel] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function mailtoHref(): string {
    const body = [
      "שלום,",
      "",
      "אשמח לדבר על פיילוט HotelOS AI.",
      "",
      `שם: ${name.trim() || "—"}`,
      `מלון / רשת: ${hotel.trim() || "—"}`,
      `אימייל: ${email.trim() || "—"}`,
      note.trim() ? `הערה: ${note.trim()}` : "",
    ]
      .filter((line) => line.length > 0)
      .join("\n");
    return `mailto:pilot@hotelos.ai?subject=${encodeURIComponent(
      "HotelOS AI Pilot",
    )}&body=${encodeURIComponent(body)}`;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus("submitting");
    setErrorMessage(null);
    try {
      await submitLead({
        name: name.trim(),
        hotelOrChain: hotel.trim(),
        email: email.trim(),
        ...(note.trim() ? { note: note.trim() } : {}),
        source: "www_contact",
      });
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "השליחה נכשלה. נסו שוב או השתמשו בקישור המייל.",
      );
    }
  }

  if (status === "success") {
    return (
      <div className="lead-form lead-form--success" role="status">
        <p>
          תודה. קיבלנו את הפרטים ונחזור אליכם בהקדם לגבי פיילוט.
        </p>
        <p className="lead-form__hint">
          אפשר גם לקבוע שיחה ישירות אם יש לכם לינק יומן, או לכתוב ל־
          <a href={PILOT_MAIL}>pilot@hotelos.ai</a>.
        </p>
      </div>
    );
  }

  return (
    <form className="lead-form" onSubmit={onSubmit} noValidate>
      <div className="lead-form__grid">
        <label className="lead-form__field">
          <span>שם</span>
          <input
            name="name"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            disabled={status === "submitting"}
          />
        </label>
        <label className="lead-form__field">
          <span>מלון / רשת</span>
          <input
            name="hotel"
            value={hotel}
            onChange={(event) => setHotel(event.target.value)}
            required
            disabled={status === "submitting"}
          />
        </label>
        <label className="lead-form__field lead-form__field--full">
          <span>אימייל</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={status === "submitting"}
          />
        </label>
        <label className="lead-form__field lead-form__field--full">
          <span>הערה (אופציונלי)</span>
          <textarea
            name="note"
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={status === "submitting"}
          />
        </label>
      </div>
      {status === "error" && errorMessage ? (
        <p className="lead-form__error" role="alert">
          {errorMessage}{" "}
          <a href={mailtoHref()}>פתיחת מייל כגיבוי</a>
        </p>
      ) : null}
      <div className="lead-form__actions">
        <button
          className="btn btn--primary"
          type="submit"
          disabled={status === "submitting"}
        >
          {status === "submitting" ? "שולחים…" : "שליחה"}
        </button>
        {CALENDLY_URL ? (
          <a
            className="btn btn--ghost"
            href={CALENDLY_URL}
            target="_blank"
            rel="noreferrer"
          >
            קביעת שיחה ביומן
          </a>
        ) : (
          <a className="btn btn--ghost" href={mailtoHref()}>
            או מייל ישיר
          </a>
        )}
      </div>
      <p className="lead-form__hint">
        השליחה נשמרת בשרת. אם אין גישה ל־API — השתמשו בקישור המייל כגיבוי.
        אפשר להגדיר <code>VITE_CALENDLY_URL</code> לקישור יומן.
      </p>
    </form>
  );
}
