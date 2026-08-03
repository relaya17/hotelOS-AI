import { useEffect, useState } from "react";
import { Button } from "@hotelos/ui";
import {
  checkInGuestStay,
  checkOutGuestStay,
  fetchGuestFolio,
  lookupGuestStay,
  type GuestFolioDto,
  type GuestStayDto,
  type RoomPrepStatusDto,
} from "@hotelos/web-client";
import { FeedbackForm } from "./feedback-form.js";
import { ServiceRequestForm } from "./service-request-form.js";
import { UpsellOffersSection } from "./upsell-offers-section.js";
import { formatCurrency } from "./stay-folio.js";

export type StayHubProps = {
  readonly email: string;
  readonly stays: readonly GuestStayDto[];
  readonly selectedIndex: number;
  readonly onSelectStay: (index: number) => void;
  readonly onStayUpdated: (stay: GuestStayDto) => void;
  readonly onSearchAgain: () => void;
};

type ActivePanel = "service" | "folio" | "feedback" | null;

const stayStatusLabel: Record<string, string> = {
  confirmed: "מאושרת",
  checked_in: "במלון",
  checked_out: "נסגרה",
};

const prepSteps: readonly {
  readonly id: RoomPrepStatusDto;
  readonly label: string;
}[] = [
  { id: "waiting", label: "ממתין" },
  { id: "cleaning", label: "מנקים" },
  { id: "ready", label: "מוכן" },
  { id: "invited", label: "מוזמן" },
];

const prepMessage: Record<RoomPrepStatusDto, string> = {
  waiting: "החדר בהכנה",
  cleaning: "מנקים את החדר",
  ready: "החדר מוכן",
  invited: "אפשר לעלות לחדר",
};

function inviteNotifyLine(stay: GuestStayDto): string | null {
  if (stay.roomPrepStatus !== "invited") return null;
  if (stay.guestPhone) return `נשלחה הודעה ל־${stay.guestPhone}`;
  return "אין טלפון בהזמנה — פנו לקבלה";
}

const prepOrder: Record<RoomPrepStatusDto, number> = {
  waiting: 0,
  cleaning: 1,
  ready: 2,
  invited: 3,
};

function formatDateRange(checkIn: string, checkOut: string): string {
  const formatter = new Intl.DateTimeFormat("he-IL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `${formatter.format(new Date(`${checkIn}T12:00:00`))} → ${formatter.format(new Date(`${checkOut}T12:00:00`))}`;
}

function RoomPrepTracker({
  status,
  notifyLine,
}: {
  readonly status: RoomPrepStatusDto;
  readonly notifyLine: string | null;
}) {
  const current = prepOrder[status];
  return (
    <section className="room-prep" aria-labelledby="room-prep-title">
      <h2 id="room-prep-title">הכנת החדר</h2>
      <p className="room-prep__status" role="status" aria-live="polite">
        {prepMessage[status]}
      </p>
      {notifyLine ? (
        <p className="room-prep__notify" role="status">
          {notifyLine}
        </p>
      ) : null}
      <ol className="room-prep__steps">
        {prepSteps.map((step, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li
              key={step.id}
              className={
                active
                  ? "room-prep__step room-prep__step--active"
                  : done
                    ? "room-prep__step room-prep__step--done"
                    : "room-prep__step"
              }
              aria-current={active ? "step" : undefined}
            >
              <span className="room-prep__dot" aria-hidden="true" />
              <span>{step.label}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function StayHub({
  email,
  stays,
  selectedIndex,
  onSelectStay,
  onStayUpdated,
  onSearchAgain,
}: StayHubProps) {
  const stay = stays[selectedIndex];
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [confirmCheckIn, setConfirmCheckIn] = useState(false);
  const [checkOutLoading, setCheckOutLoading] = useState(false);
  const [confirmCheckOut, setConfirmCheckOut] = useState(false);
  const [actionError, setActionError] = useState<string | undefined>();
  const [toast, setToast] = useState<string | undefined>();
  const [checkedOutDone, setCheckedOutDone] = useState(false);
  const [folio, setFolio] = useState<GuestFolioDto | undefined>();
  const [folioBookingId, setFolioBookingId] = useState<string | undefined>();
  const [folioError, setFolioError] = useState<string | undefined>();

  const prepStatus = stay?.roomPrepStatus ?? null;
  const bookingId = stay?.bookingId;
  const stayStatus = stay?.status;

  useEffect(() => {
    if (!prepStatus || stayStatus !== "confirmed" || !bookingId) {
      return;
    }
    const timer = window.setInterval(() => {
      void lookupGuestStay(email)
        .then((list) => {
          const updated = list.find((item) => item.bookingId === bookingId);
          if (updated) {
            onStayUpdated(updated);
          }
        })
        .catch(() => {
          /* keep last known status on transient errors */
        });
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [email, bookingId, prepStatus, stayStatus, onStayUpdated]);

  useEffect(() => {
    if (activePanel !== "folio" || !bookingId) return;

    let cancelled = false;
    setFolio(undefined);
    setFolioBookingId(undefined);
    setFolioError(undefined);
    void fetchGuestFolio({ email, bookingId })
      .then((result) => {
        if (!cancelled) {
          setFolio(result);
          setFolioBookingId(bookingId);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFolioError("לא הצלחנו לטעון את החשבון. נסו שוב.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activePanel, bookingId, email]);

  if (!stay) {
    return null;
  }

  const isConfirmed = stay.status === "confirmed";
  const isCheckedIn = stay.status === "checked_in";
  const showPrep =
    stay.status === "confirmed" && stay.roomPrepStatus !== null;

  async function handleCheckIn() {
    if (!stay) return;
    if (!confirmCheckIn) {
      setConfirmCheckIn(true);
      setToast("בדקו שם ותאריכים — לחיצה נוספת מאשרת צ׳ק-אין בלי ניירת בקבלה.");
      return;
    }
    const targetBookingId = stay.bookingId;
    setCheckInLoading(true);
    setActionError(undefined);
    try {
      const updated = await checkInGuestStay({
        email,
        bookingId: targetBookingId,
      });
      onStayUpdated(updated);
      setConfirmCheckIn(false);
      setToast("צ׳ק-אין דיגיטלי הושלם — ברוכים הבאים!");
      setActivePanel(null);
    } catch (checkInFailure) {
      setActionError(
        checkInFailure instanceof Error
          ? checkInFailure.message
          : "צ׳ק-אין נכשל",
      );
    } finally {
      setCheckInLoading(false);
    }
  }

  async function handleCheckOut() {
    if (!stay) return;
    if (!confirmCheckOut) {
      setConfirmCheckOut(true);
      setActionError(undefined);
      return;
    }
    const targetBookingId = stay.bookingId;
    setCheckOutLoading(true);
    setActionError(undefined);
    try {
      await checkOutGuestStay({
        email,
        bookingId: targetBookingId,
      });
      setCheckedOutDone(true);
      setConfirmCheckOut(false);
      setToast("צ׳ק-אאוט הושלם. תודה ששהיתם אצלנו!");
      setActivePanel(null);
    } catch (checkOutFailure) {
      setActionError(
        checkOutFailure instanceof Error
          ? checkOutFailure.message
          : "צ׳ק-אאוט נכשל",
      );
    } finally {
      setCheckOutLoading(false);
    }
  }

  function openPanel(panel: ActivePanel) {
    setActivePanel(panel);
    setActionError(undefined);
    setConfirmCheckOut(false);
    setToast(undefined);
  }

  if (checkedOutDone) {
    return (
      <section className="stay-hub" aria-labelledby="stay-hub-title">
        <p className="toast" role="status">
          צ׳ק-אאוט הושלם. החדר הועבר לניקיון.
        </p>
        <header className="stay-hero">
          <p className="eyebrow">HotelOS AI · השהייה שלכם</p>
          <h1 id="stay-hub-title">{stay.hotelName}</h1>
          <p className="stay-guest">להתראות, {stay.guestName}</p>
        </header>
        <div className="actions">
          <Button type="button" onClick={onSearchAgain}>
            חזרה לחיפוש
          </Button>
        </div>
        <style>{`
          .stay-hub { display:grid; gap:var(--space-5); }
          .toast { margin:0; padding:var(--space-3) var(--space-4); border-radius:var(--radius-sm); background:rgb(15 106 92 / 12%); color:var(--color-sea-deep); font-weight:600; }
          .stay-hero { display:grid; gap:var(--space-2); }
          .eyebrow { margin:0; letter-spacing:.08em; text-transform:uppercase; font-size:var(--text-small); color:var(--color-sea-deep); font-weight:700; }
          .stay-hero h1 { margin:0; font-size:var(--text-title); line-height:1.15; }
          .stay-guest { margin:0; color:var(--color-ink-soft); }
          .actions { display:flex; flex-wrap:wrap; gap:var(--space-2); }
        `}</style>
      </section>
    );
  }

  return (
    <section className="stay-hub" aria-labelledby="stay-hub-title">
      {toast ? (
        <p className="toast" role="status">
          {toast}
        </p>
      ) : null}

      {stays.length > 1 ? (
        <div className="stay-picker hotelos-seg" role="tablist" aria-label="בחירת שהייה">
          {stays.map((item, index) => (
            <button
              key={item.bookingId}
              type="button"
              role="tab"
              aria-selected={index === selectedIndex}
              className={
                index === selectedIndex
                  ? "hotelos-seg__item hotelos-seg__item--on"
                  : "hotelos-seg__item"
              }
              onClick={() => {
                onSelectStay(index);
                setActivePanel(null);
                setToast(undefined);
              }}
            >
              {item.hotelName}
            </button>
          ))}
        </div>
      ) : null}

      <header className="stay-hero">
        <p className="hotelos-eyebrow">HotelOS AI · השהייה שלכם</p>
        <h1 id="stay-hub-title">{stay.hotelName}</h1>
        <p className="stay-room">חדר {stay.roomNumber}</p>
        <p className="stay-guest">שלום {stay.guestName}</p>
        <span
          className={`badge badge--${stay.status}`}
          aria-label={`סטטוס: ${stayStatusLabel[stay.status] ?? stay.status}`}
        >
          {stayStatusLabel[stay.status] ?? stay.status}
        </span>
      </header>

      <p className="stay-dates">{formatDateRange(stay.checkInDate, stay.checkOutDate)}</p>

      {showPrep && stay.roomPrepStatus ? (
        <RoomPrepTracker
          status={stay.roomPrepStatus}
          notifyLine={inviteNotifyLine(stay)}
        />
      ) : null}

      <UpsellOffersSection
        email={email}
        stay={stay}
        onStayUpdated={onStayUpdated}
      />

      <div className="actions">
        {isCheckedIn ? (
          <Button type="button" onClick={() => openPanel("service")}>
            בקשת שירות לחדר
          </Button>
        ) : null}
        {isConfirmed ? (
          <Button
            type="button"
            variant="ghost"
            disabled={checkInLoading}
            aria-describedby={confirmCheckIn ? "checkin-confirm-hint" : undefined}
            onClick={() => void handleCheckIn()}
          >
            {checkInLoading
              ? "מבצע צ׳ק-אין…"
              : confirmCheckIn
                ? "אישור צ׳ק-אין"
                : "צ׳ק-אין דיגיטלי"}
          </Button>
        ) : null}
        {isCheckedIn ? (
          <Button
            type="button"
            variant="ghost"
            disabled={checkOutLoading}
            aria-describedby={confirmCheckOut ? "checkout-confirm-hint" : undefined}
            onClick={() => void handleCheckOut()}
          >
            {checkOutLoading
              ? "מבצע צ׳ק-אאוט…"
              : confirmCheckOut
                ? "אישור צ׳ק-אאוט"
                : "צ׳ק-אאוט"}
          </Button>
        ) : null}
        <Button type="button" variant="ghost" onClick={() => openPanel("folio")}>
          החשבון שלי
        </Button>
      </div>

      {confirmCheckIn && isConfirmed ? (
        <p id="checkin-confirm-hint" className="hint" role="status">
          מאשרים הגעה של {stay.guestName} · חדר {stay.roomNumber} ·{" "}
          {formatDateRange(stay.checkInDate, stay.checkOutDate)}. בלי טופס בקבלה.
        </p>
      ) : null}
      {confirmCheckOut && isCheckedIn ? (
        <p id="checkout-confirm-hint" className="hint" role="status">
          לחיצה נוספת מאשרת יציאה — החדר יועבר לניקיון.
        </p>
      ) : null}

      {actionError ? (
        <p className="state state--error" role="alert">
          {actionError}
        </p>
      ) : null}

      {activePanel === "service" ? (
        <ServiceRequestForm
          email={email}
          bookingId={stay.bookingId}
          onClose={() => setActivePanel(null)}
        />
      ) : null}

      {activePanel === "folio" ? (
        <div className="folio">
          <h2>אומדן חשבון</h2>
          <p className="folio-note">
            אומדן בלבד — לא חשבון סופי. ייתכנו עדכונים עד הצ׳ק-אאוט.
          </p>
          {folioError ? (
            <p className="folio-note" role="alert">
              {folioError}
            </p>
          ) : folio && folioBookingId === stay.bookingId ? (
            <>
              <p className="folio-meta">
                {formatDateRange(folio.checkInDate, folio.checkOutDate)}
                {" · "}
                {folio.nights} לילות
                {" · "}
                חדר {folio.roomNumber}
              </p>
              <ul className="folio-lines">
                {folio.lines.map((line) => (
                  <li key={line.label}>
                    <span>{line.label}</span>
                    <span>{formatCurrency(line.amount, folio.currency)}</span>
                  </li>
                ))}
                <li>
                  <span>סכום ביניים</span>
                  <span>{formatCurrency(folio.subtotal, folio.currency)}</span>
                </li>
                <li>
                  <span>מע״מ (17%)</span>
                  <span>{formatCurrency(folio.tax, folio.currency)}</span>
                </li>
              </ul>
              <p className="folio-total">
                <span>סה״כ</span>
                <strong>{formatCurrency(folio.total, folio.currency)}</strong>
              </p>
              <p className="folio-balance">
                <span>יתרה לתשלום</span>
                <strong>
                  {formatCurrency(folio.balanceDue, folio.currency)}
                </strong>
              </p>
            </>
          ) : (
            <p className="folio-note" role="status">
              טוענים חשבון…
            </p>
          )}
          <Button type="button" variant="ghost" onClick={() => setActivePanel(null)}>
            סגור
          </Button>
        </div>
      ) : null}

      {activePanel === "feedback" ? (
        <FeedbackForm
          bookingId={stay.bookingId}
          onDone={() => setActivePanel(null)}
        />
      ) : null}

      <div className="stay-secondary">
        <Button type="button" variant="ghost" onClick={() => openPanel("feedback")}>
          השאירו משוב על השהייה
        </Button>
        <Button type="button" variant="ghost" onClick={onSearchAgain}>
          חיפוש עם אימייל אחר
        </Button>
      </div>

      <style>{`
        .stay-hub { display:grid; gap:var(--space-5); animation:hotelos-enter var(--motion-med) var(--ease-out) both; }
        .toast { margin:0; padding:var(--space-3) var(--space-4); border-radius:var(--radius-sm); background:var(--color-sea-soft); color:var(--color-sea-deep); font-weight:600; border:1px solid rgb(14 107 92 / 16%); }
        .stay-picker { flex-wrap:wrap; width:fit-content; max-width:100%; }
        .stay-hero { display:grid; gap:var(--space-2); }
        .stay-hero h1 { margin:0; font-size:var(--text-title); line-height:1.15; }
        .stay-room { margin:0; font-family:var(--font-display); font-size:1.35rem; color:var(--color-ink); letter-spacing:var(--tracking-display); }
        .stay-guest { margin:0; color:var(--color-ink-soft); font-weight:500; }
        .badge { justify-self:start; font-size:var(--text-micro); font-weight:700; padding:.4rem .75rem; border-radius:var(--radius-pill); }
        .badge--confirmed { color:var(--color-sea-deep); background:var(--color-sea-soft); }
        .badge--checked_in { color:var(--color-info); background:var(--color-info-soft); }
        .badge--checked_out { color:var(--color-ink-soft); background:rgb(12 31 26 / 6%); }
        .stay-dates { margin:0; font-size:1.05rem; color:var(--color-ink-soft); font-weight:500; }
        .hint { margin:0; font-size:var(--text-small); color:var(--color-ink-soft); font-weight:500; }
        .room-prep { display:grid; gap:var(--space-3); padding:var(--space-4); border:1px solid var(--color-line); border-radius:var(--radius-md); background:var(--color-paper-elevated); box-shadow:var(--shadow-soft); }
        .room-prep h2 { margin:0; font-size:1.15rem; }
        .room-prep__status { margin:0; font-weight:700; color:var(--color-sea-deep); }
        .room-prep__notify { margin:0; font-size:var(--text-small); color:var(--color-ink-soft); font-weight:500; }
        .room-prep__steps { list-style:none; margin:0; padding:0; display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:var(--space-2); }
        .room-prep__step { display:grid; justify-items:center; gap:.35rem; font-size:var(--text-small); color:var(--color-ink-soft); text-align:center; }
        .room-prep__dot { width:.65rem; height:.65rem; border-radius:50%; background:var(--color-line-strong); }
        .room-prep__step--done { color:var(--color-ink); }
        .room-prep__step--done .room-prep__dot { background:rgb(14 107 92 / 55%); }
        .room-prep__step--active { color:var(--color-sea-deep); font-weight:700; }
        .room-prep__step--active .room-prep__dot { background:var(--color-sea-deep); box-shadow:var(--shadow-ring); }
        @media (max-width:420px) {
          .room-prep__steps { grid-template-columns:repeat(2,minmax(0,1fr)); }
        }
        .actions { display:flex; flex-wrap:wrap; gap:var(--space-2); }
        .folio { padding:var(--space-4); border:1px solid var(--color-line); border-radius:var(--radius-md); background:var(--color-paper-elevated); display:grid; gap:var(--space-3); box-shadow:var(--shadow-soft); }
        .folio h2 { margin:0; font-size:1.15rem; }
        .folio-note { margin:0; font-size:var(--text-small); color:var(--color-ink-soft); font-weight:500; }
        .folio-meta { margin:0; font-size:var(--text-small); color:var(--color-ink-soft); font-weight:500; }
        .folio-lines { list-style:none; margin:0; padding:0; display:grid; gap:var(--space-2); }
        .folio-lines li { display:flex; justify-content:space-between; gap:var(--space-3); font-size:var(--text-small); color:var(--color-ink-soft); }
        .folio-total,.folio-balance { margin:0; display:flex; justify-content:space-between; align-items:baseline; padding-top:var(--space-2); border-top:1px solid var(--color-line); }
        .folio-balance { color:var(--color-sea-deep); }
        .stay-secondary { display:flex; flex-wrap:wrap; gap:var(--space-2); padding-top:var(--space-2); border-top:1px solid var(--color-line); }
        .state { margin:0; color:var(--color-ink-soft); font-weight:500; }
        .state--error { color:var(--color-danger); }
      `}</style>
    </section>
  );
}
