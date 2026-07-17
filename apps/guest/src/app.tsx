import { useState, type FormEvent } from "react";
import { Button, TextField } from "@hotelos/ui";
import {
  APP_URLS,
  lookupGuestStay,
  type GuestStayDto,
} from "@hotelos/web-client";

const stayStatusLabel: Record<string, string> = {
  confirmed: "מאושרת",
  checked_in: "במלון",
};

export function App() {
  const [email, setEmail] = useState("noa@example.com");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [stays, setStays] = useState<readonly GuestStayDto[] | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    try {
      const data = await lookupGuestStay(email);
      setStays(data);
      if (data.length === 0) {
        setError("לא נמצאה שהייה פעילה לאימייל זה");
      }
    } catch (lookupError) {
      setError(
        lookupError instanceof Error ? lookupError.message : "שגיאה בחיפוש",
      );
      setStays(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Guest · אורחים</p>
        <h1>HotelOS AI</h1>
        <p className="lede">
          אפליקציה נפרדת לאורחים — צפו בשהייה, חדר ושירותים בלי לגשת לקבלה.
        </p>
        <p className="apps">
          צוות: <a href={APP_URLS.admin}>Admin</a> · הנהלה:{" "}
          <a href={APP_URLS.executive}>Executive</a>
        </p>
      </section>

      <section className="panel">
        <form className="form" onSubmit={onSubmit} noValidate>
          <h2>השהייה שלי</h2>
          <TextField
            label="אימייל בהזמנה"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            {...(error !== undefined && stays?.length === 0
              ? { error }
              : error !== undefined && stays === null
                ? { error }
                : {})}
          />
          <Button type="submit" disabled={loading}>
            {loading ? "מחפש…" : "מצא שהייה"}
          </Button>
        </form>

        {stays && stays.length > 0 ? (
          <ul className="stays">
            {stays.map((stay) => (
              <li key={stay.bookingId} className="stay">
                <h3>{stay.hotelName}</h3>
                <p>
                  שלום {stay.guestName} · חדר {stay.roomNumber}
                </p>
                <p>
                  {stay.checkInDate} → {stay.checkOutDate}
                </p>
                <span className="badge">
                  {stayStatusLabel[stay.status] ?? stay.status}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <style>{`
        .shell { min-height:100vh; display:grid; grid-template-columns:1.05fr .95fr; gap:var(--space-6); padding:clamp(1.5rem,4vw,4rem); align-items:center; }
        .eyebrow { margin:0 0 var(--space-3); letter-spacing:.08em; text-transform:uppercase; font-size:var(--text-small); color:var(--color-sea-deep); font-weight:700; }
        h1 { font-size:var(--text-display); margin:0; }
        .lede { margin:var(--space-4) 0 0; max-width:34ch; color:var(--color-ink-soft); font-size:1.15rem; }
        .apps { margin-top:var(--space-4); font-size:var(--text-small); }
        .panel { background:rgb(255 250 242 / 88%); border:1px solid rgb(16 36 31 / 10%); border-radius:calc(var(--radius-md) + .15rem); box-shadow:var(--shadow-soft); padding:clamp(1.4rem,3vw,2.2rem); display:grid; gap:var(--space-5); }
        .form { display:grid; gap:var(--space-4); }
        .form h2 { margin:0; font-size:var(--text-title); }
        .stays { list-style:none; margin:0; padding:0; display:grid; gap:var(--space-3); }
        .stay { padding:var(--space-4); border:1px solid rgb(16 36 31 / 10%); border-radius:var(--radius-sm); background:var(--color-paper-elevated); display:grid; gap:var(--space-2); }
        .stay h3 { margin:0; font-family:var(--font-display); }
        .stay p { margin:0; color:var(--color-ink-soft); }
        .badge { justify-self:start; font-size:var(--text-small); font-weight:700; color:var(--color-sea-deep); background:rgb(15 106 92 / 12%); padding:.35rem .7rem; border-radius:999px; }
        @media (max-width:900px){ .shell{ grid-template-columns:1fr; } }
      `}</style>
    </main>
  );
}
