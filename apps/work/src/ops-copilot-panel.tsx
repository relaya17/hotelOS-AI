import { useEffect, useState } from "react";
import { Button } from "@hotelos/ui";
import {
  APP_URLS,
  listBookings,
  listHotels,
  listRooms,
  suggestAutonomyDirtyRooms,
  suggestAutonomyTodaysArrivals,
  type BookingDto,
  type RoomDto,
  type StoredUser,
} from "@hotelos/web-client";

export type OpsCopilotPanelProps = {
  readonly user: StoredUser;
};

const HK_ROLES = [
  "housekeeping",
  "admin",
  "executive",
  "owner",
  "gm",
] as const;

const RECEPTION_ROLES = [
  "reception",
  "admin",
  "executive",
  "owner",
  "gm",
] as const;

export function canAccessOpsCopilot(roles: readonly string[]): boolean {
  return (
    HK_ROLES.some((role) => roles.includes(role)) ||
    RECEPTION_ROLES.some((role) => roles.includes(role))
  );
}

function hasRole(
  roles: readonly string[],
  allowed: readonly string[],
): boolean {
  return allowed.some((role) => roles.includes(role));
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function adminApprovalsUrl(hotelId: string): string {
  const params = new URLSearchParams({
    panel: "approvals",
    hotelId,
  });
  return `${APP_URLS.admin}/?${params.toString()}`;
}

type PendingSuggest = {
  readonly kind: "housekeeping" | "reception";
  readonly approvalId: string;
  readonly detailHe: string;
};

export function OpsCopilotPanel({ user }: OpsCopilotPanelProps) {
  const showHousekeeping = hasRole(user.roles, HK_ROLES);
  const showReception = hasRole(user.roles, RECEPTION_ROLES);

  const [hotelId, setHotelId] = useState<string | undefined>(user.hotelId);
  const [rooms, setRooms] = useState<readonly RoomDto[]>([]);
  const [bookings, setBookings] = useState<readonly BookingDto[]>([]);
  const [checkInDate] = useState(todayUtc);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"hk" | "reception" | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState<PendingSuggest | undefined>();

  useEffect(() => {
    let cancelled = false;
    async function resolveHotel() {
      if (hotelId) return;
      try {
        const hotels = await listHotels();
        if (!cancelled && hotels[0]) {
          setHotelId(hotels[0].id);
        }
      } catch {
        if (!cancelled) {
          setError("לא ניתן לטעון מלון — נסו שוב");
        }
      }
    }
    void resolveHotel();
    return () => {
      cancelled = true;
    };
  }, [hotelId]);

  useEffect(() => {
    if (!hotelId) return;
    const resolvedHotelId = hotelId;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(undefined);
      try {
        const tasks: Promise<unknown>[] = [];
        if (showHousekeeping) {
          tasks.push(
            listRooms(resolvedHotelId).then((data) => {
              if (!cancelled) setRooms(data);
            }),
          );
        }
        if (showReception) {
          tasks.push(
            listBookings(resolvedHotelId).then((data) => {
              if (!cancelled) setBookings(data);
            }),
          );
        }
        await Promise.all(tasks);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "שגיאה בטעינה",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [hotelId, showHousekeeping, showReception]);

  const dirtyRooms = rooms.filter((room) => room.status === "dirty");
  const arrivals = bookings.filter(
    (booking) =>
      booking.status === "confirmed" && booking.checkInDate === checkInDate,
  );

  async function onSuggestHousekeeping() {
    if (!hotelId || dirtyRooms.length === 0) return;
    setBusy("hk");
    setError(undefined);
    setPending(undefined);
    try {
      const result = await suggestAutonomyDirtyRooms({
        hotelId,
        roomIds: dirtyRooms.map((room) => room.id),
      });
      setPending({
        kind: "housekeeping",
        approvalId: result.approvalId,
        detailHe: `${result.dirtyRoomCount} חדרים לניקיון (${result.rooms.map((r) => r.number).join(", ")})`,
      });
    } catch (suggestError) {
      setError(
        suggestError instanceof Error
          ? suggestError.message
          : "הצעת שיבוץ ניקיון נכשלה",
      );
    } finally {
      setBusy(undefined);
    }
  }

  async function onSuggestReception() {
    if (!hotelId || arrivals.length === 0) return;
    setBusy("reception");
    setError(undefined);
    setPending(undefined);
    try {
      const result = await suggestAutonomyTodaysArrivals({
        hotelId,
        checkInDate,
        bookingIds: arrivals.map((booking) => booking.id),
      });
      setPending({
        kind: "reception",
        approvalId: result.approvalId,
        detailHe: `${result.arrivalCount} הגעות ל־${result.checkInDate}`,
      });
    } catch (suggestError) {
      setError(
        suggestError instanceof Error
          ? suggestError.message
          : "הצעת הכנת הגעות נכשלה",
      );
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <section className="ops-copilot" aria-labelledby="ops-copilot-title">
      <header className="ops-copilot__head">
        <h2 id="ops-copilot-title">Copilot תפעול</h2>
        <p>
          כפתורי Suggest→Approve→Act — לא צ׳אט בלבד. שליחת הצעה יוצרת אישור
          ממתין; מפקח/GM מאשר ב־Admin או Executive לפני פתיחת משימות.
        </p>
      </header>

      {loading ? <p className="ops-copilot__state">טוען…</p> : null}
      {error ? (
        <p className="ops-copilot__error" role="alert">
          {error}
        </p>
      ) : null}

      {pending && hotelId ? (
        <div className="ops-copilot__pending" role="status">
          <p className="ops-copilot__pending-title">הצעה נשלחה — ממתינה לאישור</p>
          <p>
            {pending.kind === "housekeeping"
              ? "שיבוץ ניקיון"
              : "הכנת הגעות קבלה"}
            : {pending.detailHe}
          </p>
          <p className="ops-copilot__pending-id">
            מזהה אישור: <code>{pending.approvalId}</code>
          </p>
          <p className="ops-copilot__pending-hint">
            Work לא מאשר — פנו למפקח/GM לאשר ולהפעיל Act (ללא כתיבה אוטומטית
            ל־PMS או כסף).
          </p>
          <div className="ops-copilot__links">
            <a href={adminApprovalsUrl(hotelId)}>אישורי AI ב־Admin (ops) →</a>
            <a href={APP_URLS.executive}>Executive HQ → אישורי AI</a>
          </div>
        </div>
      ) : null}

      {showHousekeeping ? (
        <section className="ops-copilot__card" aria-labelledby="hk-title">
          <h3 id="hk-title">משק בית · שיבוץ ניקיון</h3>
          <p className="ops-copilot__hint">
            Suggest לכל החדרים במצב dirty — אחרי Approve נפתחות משימות במחלקה.
          </p>
          {dirtyRooms.length === 0 ? (
            <p className="ops-copilot__state">אין חדרים dirty כרגע.</p>
          ) : (
            <>
              <ul className="ops-copilot__list">
                {dirtyRooms.map((room) => (
                  <li key={room.id}>
                    חדר {room.number} · קומה {room.floor} · {room.roomType}
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                disabled={busy !== undefined || !hotelId}
                onClick={() => void onSuggestHousekeeping()}
              >
                {busy === "hk"
                  ? "שולח הצעה…"
                  : `הצע שיבוץ ניקיון (${dirtyRooms.length})`}
              </Button>
            </>
          )}
        </section>
      ) : null}

      {showReception ? (
        <section className="ops-copilot__card" aria-labelledby="reception-title">
          <h3 id="reception-title">קבלה · הכנת הגעות היום</h3>
          <p className="ops-copilot__hint">
            Suggest לכל ההגעות confirmed ל־{checkInDate} — ללא צ׳ק-אין אוטומטי.
          </p>
          {arrivals.length === 0 ? (
            <p className="ops-copilot__state">
              אין הגעות confirmed לתאריך {checkInDate}.
            </p>
          ) : (
            <>
              <ul className="ops-copilot__list">
                {arrivals.map((booking) => (
                  <li key={booking.id}>
                    {booking.guestName} · חדר {booking.roomNumber}
                    {booking.roomPrepStatus
                      ? ` · ${booking.roomPrepStatus}`
                      : ""}
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                disabled={busy !== undefined || !hotelId}
                onClick={() => void onSuggestReception()}
              >
                {busy === "reception"
                  ? "שולח הצעה…"
                  : `הצע הכנת הגעות (${arrivals.length})`}
              </Button>
            </>
          )}
        </section>
      ) : null}

      <style>{`
        .ops-copilot { display: grid; gap: var(--space-4); }
        .ops-copilot__head { display: grid; gap: var(--space-2); }
        .ops-copilot__head h2 {
          font-size: clamp(1.35rem, 2.5vw, 1.7rem);
          color: var(--color-sea-deep);
          margin: 0;
        }
        .ops-copilot__head p {
          margin: 0;
          color: var(--color-ink-soft);
          font-weight: 500;
          line-height: 1.6;
          max-width: 46ch;
        }
        .ops-copilot__card {
          display: grid;
          gap: var(--space-3);
          padding: var(--space-4);
          border: 1px solid var(--color-line);
          border-radius: var(--radius-md);
          background: var(--color-paper-elevated);
          box-shadow: var(--shadow-soft);
        }
        .ops-copilot__card h3 {
          margin: 0;
          font-size: 1.1rem;
          color: var(--color-sea-deep);
        }
        .ops-copilot__hint {
          margin: 0;
          color: var(--color-ink-soft);
          font-size: var(--text-small);
          font-weight: 500;
          line-height: 1.55;
        }
        .ops-copilot__list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 0.35rem;
          font-size: var(--text-small);
          color: var(--color-ink-soft);
          font-weight: 500;
        }
        .ops-copilot__state {
          margin: 0;
          color: var(--color-ink-faint);
          font-weight: 500;
        }
        .ops-copilot__error {
          margin: 0;
          color: var(--color-danger);
          font-weight: 600;
          font-size: var(--text-small);
        }
        .ops-copilot__pending {
          display: grid;
          gap: var(--space-2);
          padding: var(--space-3) var(--space-4);
          border-radius: var(--radius-sm);
          background: var(--color-sea-soft);
          color: var(--color-sea-deep);
          font-weight: 500;
          line-height: 1.55;
        }
        .ops-copilot__pending-title {
          margin: 0;
          font-weight: 700;
        }
        .ops-copilot__pending p { margin: 0; }
        .ops-copilot__pending-id code {
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 0.85em;
          word-break: break-all;
        }
        .ops-copilot__pending-hint {
          font-size: var(--text-small);
        }
        .ops-copilot__links {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-3);
          margin-top: 0.25rem;
        }
        .ops-copilot__links a {
          color: var(--color-sea-deep);
          font-weight: 700;
          font-size: var(--text-small);
          text-decoration: none;
        }
        .ops-copilot__links a:hover { text-decoration: underline; }
      `}</style>
    </section>
  );
}
