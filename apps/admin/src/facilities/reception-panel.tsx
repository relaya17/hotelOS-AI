import { useEffect, useState } from "react";
import { Button } from "@hotelos/ui";
import {
  listBookings,
  suggestAutonomyTodaysArrivals,
  type BookingDto,
} from "@hotelos/web-client";

export type ReceptionPanelProps = {
  readonly hotelId: string;
};

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ReceptionPanel({ hotelId }: ReceptionPanelProps) {
  const [bookings, setBookings] = useState<readonly BookingDto[]>([]);
  const [checkInDate, setCheckInDate] = useState(todayUtc);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [suggesting, setSuggesting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  async function reload() {
    setLoading(true);
    setError(undefined);
    try {
      const data = await listBookings(hotelId);
      setBookings(data);
      setSelected((prev) => {
        const arrivalIds = new Set(
          data
            .filter(
              (b) =>
                b.status === "confirmed" && b.checkInDate === checkInDate,
            )
            .map((b) => b.id),
        );
        if (prev.size === 0) return arrivalIds;
        return new Set([...prev].filter((id) => arrivalIds.has(id)));
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "שגיאה בטעינה");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [hotelId, checkInDate]);

  const arrivals = bookings.filter(
    (booking) =>
      booking.status === "confirmed" && booking.checkInDate === checkInDate,
  );

  function toggleBooking(bookingId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(bookingId)) next.delete(bookingId);
      else next.add(bookingId);
      return next;
    });
  }

  async function onSuggest() {
    const bookingIds = arrivals
      .filter((booking) => selected.has(booking.id))
      .map((booking) => booking.id);
    if (bookingIds.length === 0) {
      setError("בחרו לפחות הגעה אחת");
      return;
    }
    setSuggesting(true);
    setError(undefined);
    try {
      const result = await suggestAutonomyTodaysArrivals({
        hotelId,
        checkInDate,
        bookingIds,
      });
      setNotice(
        `Suggest נשלח לאישורי AI: ${result.arrivalCount} הגעות ב־${result.checkInDate}. אשרו → Act ייפתח משימות הכנה בקבלה (ללא צ'ק-אין אוטומטי).`,
      );
    } catch (suggestError) {
      setError(
        suggestError instanceof Error
          ? suggestError.message
          : "הצעת הכנת הגעות נכשלה",
      );
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <div className="panel">
      {loading ? <p className="state">טוען…</p> : null}
      {error !== undefined ? (
        <p className="state state--error" role="alert">
          {error}
        </p>
      ) : null}
      {notice !== undefined ? (
        <p className="state state--ok" role="status">
          {notice}
        </p>
      ) : null}

      <section className="card">
        <h2>קבלה · הכנת הגעות</h2>
        <p className="hint">
          Suggest→Approve→Act: הצעת משימות הכנת צ׳ק-אין לתיבת אישורי AI. אחרי
          אישור נפתחות משימות במחלקת קבלה — ללא צ׳ק-אין אוטומטי, ללא שינוי תעריף.
        </p>

        <label className="date-field">
          תאריך צ׳ק-אין
          <input
            type="date"
            value={checkInDate}
            onChange={(e) => setCheckInDate(e.target.value)}
          />
        </label>

        {arrivals.length === 0 ? (
          <p className="hint">אין הזמנות confirmed לתאריך זה.</p>
        ) : (
          <>
            <ul className="list">
              {arrivals.map((booking) => (
                <li key={booking.id}>
                  <label className="row">
                    <input
                      type="checkbox"
                      checked={selected.has(booking.id)}
                      onChange={() => toggleBooking(booking.id)}
                    />
                    <span>
                      <strong>{booking.guestName}</strong>
                      <span className="muted">
                        {" "}
                        · חדר {booking.roomNumber} · עד {booking.checkOutDate}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              disabled={suggesting || selected.size === 0}
              onClick={() => void onSuggest()}
            >
              {suggesting
                ? "שולח…"
                : `שלח Suggest לאישור (${selected.size})`}
            </Button>
          </>
        )}
      </section>

      <style>{`
        .panel{display:grid;gap:1rem}
        .card{display:grid;gap:.75rem;border:1px solid rgb(16 36 31 / 12%);border-radius:8px;padding:1rem;background:rgb(255 250 242 / 55%)}
        .card h2{margin:0;font-family:var(--font-display)}
        .hint{margin:0;opacity:.78;font-size:.92rem}
        .muted{opacity:.75}
        .date-field{display:grid;gap:.25rem;font-size:.9rem;max-width:14rem}
        .date-field input{font:inherit;padding:.4rem .5rem}
        .list{list-style:none;padding:0;margin:0;display:grid;gap:.5rem}
        .row{display:flex;gap:.6rem;align-items:flex-start}
        .state--error{color:#8b1e1e}
        .state--ok{color:#1a5c45}
      `}</style>
    </div>
  );
}
