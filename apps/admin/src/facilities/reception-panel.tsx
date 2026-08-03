import { useEffect, useState } from "react";
import { Button } from "@hotelos/ui";
import {
  listBookings,
  listHotelNotifications,
  suggestAutonomyTodaysArrivals,
  updateBookingRoomPrep,
  type BookingDto,
  type GuestNotificationDto,
  type RoomPrepStatusDto,
} from "@hotelos/web-client";

export type ReceptionPanelProps = {
  readonly hotelId: string;
};

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

const prepLabel: Record<RoomPrepStatusDto, string> = {
  waiting: "ממתין",
  cleaning: "מנקים",
  ready: "מוכן",
  invited: "מוזמן",
};

function truncateAt(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

export function ReceptionPanel({ hotelId }: ReceptionPanelProps) {
  const [bookings, setBookings] = useState<readonly BookingDto[]>([]);
  const [notifications, setNotifications] = useState<
    readonly GuestNotificationDto[]
  >([]);
  const [checkInDate, setCheckInDate] = useState(todayUtc);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [suggesting, setSuggesting] = useState(false);
  const [actingId, setActingId] = useState<string | undefined>();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  async function reload() {
    setLoading(true);
    setError(undefined);
    try {
      const [data, notificationList] = await Promise.all([
        listBookings(hotelId),
        listHotelNotifications(hotelId),
      ]);
      setBookings(data);
      setNotifications(notificationList);
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

  const waitingQueue = bookings.filter(
    (booking) =>
      booking.status === "confirmed" && booking.roomPrepStatus !== null,
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

  async function onRoomPrep(
    bookingId: string,
    status: "waiting" | "invited",
  ) {
    setActingId(bookingId);
    setError(undefined);
    try {
      const updated = await updateBookingRoomPrep(hotelId, bookingId, status);
      if (status === "waiting") {
        setNotice("האורח סומן כממתין לחדר");
      } else if (updated.notification?.status === "sent") {
        setNotice(
          `האורח הוזמן · הודעה נשלחה ל־${updated.notification.toAddress ?? "טלפון"}`,
        );
      } else if (updated.notification?.status === "skipped") {
        setNotice("האורח הוזמן · אין טלפון — לא נשלחה הודעה");
      } else if (updated.notification?.status === "failed") {
        setNotice(
          `האורח הוזמן · שליחת WhatsApp נכשלה (${updated.notification.error ?? "שגיאה"}). ניסיון חוזר אוטומטי בקרוב.`,
        );
      } else if (updated.notification?.status === "pending") {
        setNotice("האורח הוזמן · ההודעה ממתינה לשליחה");
      } else {
        setNotice("האורח הוזמן לחדר");
      }
      await reload();
    } catch (prepError) {
      setError(
        prepError instanceof Error ? prepError.message : "עדכון הכנת חדר נכשל",
      );
    } finally {
      setActingId(undefined);
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

      <section className="card" aria-labelledby="waiting-title">
        <h2 id="waiting-title">ממתינים לחדר</h2>
        <p className="hint">מעקב קצר: ממתין → מנקים → מוכן → הזמן.</p>
        {waitingQueue.length === 0 ? (
          <p className="hint">אין ממתינים כרגע.</p>
        ) : (
          <ul className="list">
            {waitingQueue.map((booking) => {
              const prep = booking.roomPrepStatus;
              return (
                <li key={booking.id} className="wait-row">
                  <div>
                    <strong>{booking.guestName}</strong>
                    <span className="muted">
                      {" "}
                      · חדר {booking.roomNumber}
                      {prep ? ` · ${prepLabel[prep]}` : ""}
                    </span>
                  </div>
                  {prep === "ready" ? (
                    <Button
                      type="button"
                      disabled={actingId === booking.id}
                      onClick={() => void onRoomPrep(booking.id, "invited")}
                    >
                      {actingId === booking.id ? "מעדכן…" : "הזמן לחדר"}
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card" aria-labelledby="guest-notifications-title">
        <h2 id="guest-notifications-title">הודעות אורחים</h2>
        {notifications.length === 0 ? (
          <p className="hint">אין הודעות עדיין.</p>
        ) : (
          <ul className="list notify-list">
            {notifications.slice(0, 12).map((item) => (
              <li key={item.id} className="notify-row">
                <span className="notify-status">{item.status}</span>
                <span className="muted">
                  {item.toAddress ?? "—"}
                  {item.attemptCount
                    ? ` · ניסיון ${item.attemptCount}`
                    : ""}
                  {item.error ? ` · ${truncateAt(item.error, 40)}` : ""}
                </span>
                <time dateTime={item.createdAt} className="muted">
                  {truncateAt(item.createdAt.replace("T", " "), 16)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

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
                <li key={booking.id} className="arrival-item">
                  <label className="row">
                    <input
                      type="checkbox"
                      aria-label={`${booking.guestName}, חדר ${booking.roomNumber}`}
                      checked={selected.has(booking.id)}
                      onChange={() => toggleBooking(booking.id)}
                    />
                    <span>
                      <strong>{booking.guestName}</strong>
                      <span className="muted">
                        {" "}
                        · חדר {booking.roomNumber} · עד {booking.checkOutDate}
                        {booking.roomPrepStatus
                          ? ` · ${prepLabel[booking.roomPrepStatus]}`
                          : ""}
                      </span>
                    </span>
                  </label>
                  {!booking.roomPrepStatus ? (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={actingId === booking.id}
                      onClick={() => void onRoomPrep(booking.id, "waiting")}
                    >
                      {actingId === booking.id ? "מעדכן…" : "ממתין"}
                    </Button>
                  ) : null}
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
        .panel{display:grid;gap:var(--space-4)}
        .card{display:grid;gap:var(--space-3);border:1px solid var(--color-line);border-radius:var(--radius-md);padding:var(--space-4);background:var(--color-paper-elevated);box-shadow:var(--shadow-soft)}
        .card h2{margin:0;font-size:1.15rem}
        .hint{margin:0;color:var(--color-ink-soft);font-size:var(--text-small);font-weight:500}
        .muted{color:var(--color-ink-soft);font-weight:500}
        .date-field{display:grid;gap:var(--space-2);font-size:var(--text-small);font-weight:600;color:var(--color-ink-soft);max-width:14rem}
        .date-field input{font:inherit;padding:.55rem .7rem;border:1px solid var(--color-line-strong);border-radius:var(--radius-sm);background:#fff}
        .list{list-style:none;padding:0;margin:0;display:grid;gap:var(--space-2)}
        .row{display:flex;gap:var(--space-2);align-items:flex-start}
        .wait-row,.arrival-item{display:flex;flex-wrap:wrap;gap:var(--space-2);align-items:center;justify-content:space-between;padding:var(--space-3);border:1px solid var(--color-line);border-radius:var(--radius-sm);background:#fff}
        .notify-list{gap:.35rem}
        .notify-row{display:grid;grid-template-columns:auto 1fr auto;gap:.4rem .75rem;align-items:baseline;font-size:var(--text-small)}
        .notify-status{font-weight:700}
        .state--error{color:var(--color-danger)}
        .state--ok{color:var(--color-sea-deep);font-weight:600}
      `}</style>
    </div>
  );
}
