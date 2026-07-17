import { useState } from "react";
import { Button } from "@hotelos/ui";
import {
  checkInGuestStay,
  type GuestStayDto,
} from "@hotelos/web-client";
import { FeedbackForm } from "./feedback-form.js";
import { ServiceRequestForm } from "./service-request-form.js";
import { estimateFolio, formatCurrency } from "./stay-folio.js";

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
};

function formatDateRange(checkIn: string, checkOut: string): string {
  const formatter = new Intl.DateTimeFormat("he-IL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `${formatter.format(new Date(`${checkIn}T12:00:00`))} → ${formatter.format(new Date(`${checkOut}T12:00:00`))}`;
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
  const [checkInError, setCheckInError] = useState<string | undefined>();
  const [toast, setToast] = useState<string | undefined>();

  if (!stay) {
    return null;
  }

  const folio = estimateFolio(stay);
  const isConfirmed = stay.status === "confirmed";
  const bookingId = stay.bookingId;

  async function handleCheckIn() {
    setCheckInLoading(true);
    setCheckInError(undefined);
    try {
      const updated = await checkInGuestStay({
        email,
        bookingId,
      });
      onStayUpdated(updated);
      setToast("צ׳ק-אין דיגיטלי הושלם — ברוכים הבאים!");
      setActivePanel(null);
    } catch (checkInFailure) {
      setCheckInError(
        checkInFailure instanceof Error
          ? checkInFailure.message
          : "צ׳ק-אין נכשל",
      );
    } finally {
      setCheckInLoading(false);
    }
  }

  function openPanel(panel: ActivePanel) {
    setActivePanel(panel);
    setCheckInError(undefined);
    setToast(undefined);
  }

  return (
    <section className="stay-hub" aria-labelledby="stay-hub-title">
      {toast ? (
        <p className="toast" role="status">
          {toast}
        </p>
      ) : null}

      {stays.length > 1 ? (
        <div className="stay-picker" role="tablist" aria-label="בחירת שהייה">
          {stays.map((item, index) => (
            <button
              key={item.bookingId}
              type="button"
              role="tab"
              aria-selected={index === selectedIndex}
              className={
                index === selectedIndex ? "stay-tab stay-tab--active" : "stay-tab"
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
        <p className="eyebrow">HotelOS AI · השהייה שלכם</p>
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

      <div className="actions">
        <Button type="button" onClick={() => openPanel("service")}>
          בקשת שירות לחדר
        </Button>
        {isConfirmed ? (
          <Button
            type="button"
            variant="ghost"
            disabled={checkInLoading}
            onClick={() => void handleCheckIn()}
          >
            {checkInLoading ? "מבצע צ׳ק-אין…" : "צ׳ק-אין דיגיטלי"}
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            disabled
            aria-disabled="true"
            title="כבר בוצע צ׳ק-אין"
          >
            צ׳ק-אין הושלם
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={() => openPanel("folio")}>
          החשבון שלי
        </Button>
      </div>

      {checkInError ? (
        <p className="state state--error" role="alert">
          {checkInError}
        </p>
      ) : null}

      {activePanel === "service" ? (
        <ServiceRequestForm onClose={() => setActivePanel(null)} />
      ) : null}

      {activePanel === "folio" ? (
        <div className="folio">
          <h2>החשבון שלי (הערכה)</h2>
          <p className="folio-note">
            סיכום משוער לפי תאריכי השהייה — לא חשבון סופי.
          </p>
          <ul className="folio-lines">
            {folio.lines.map((line) => (
              <li key={line.label}>
                <span>{line.label}</span>
                <span>{formatCurrency(line.amount, folio.currency)}</span>
              </li>
            ))}
          </ul>
          <p className="folio-total">
            <span>סה״כ משוער</span>
            <strong>{formatCurrency(folio.total, folio.currency)}</strong>
          </p>
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
        .stay-hub { display:grid; gap:var(--space-5); }
        .toast { margin:0; padding:var(--space-3) var(--space-4); border-radius:var(--radius-sm); background:rgb(15 106 92 / 12%); color:var(--color-sea-deep); font-weight:600; }
        .stay-picker { display:flex; flex-wrap:wrap; gap:var(--space-2); }
        .stay-tab { font:inherit; font-size:var(--text-small); font-weight:600; padding:.45rem .85rem; border-radius:999px; border:1px solid rgb(16 36 31 / 14%); background:transparent; cursor:pointer; color:var(--color-ink-soft); }
        .stay-tab--active { background:rgb(15 106 92 / 12%); border-color:rgb(15 106 92 / 30%); color:var(--color-sea-deep); }
        .stay-hero { display:grid; gap:var(--space-2); }
        .eyebrow { margin:0; letter-spacing:.08em; text-transform:uppercase; font-size:var(--text-small); color:var(--color-sea-deep); font-weight:700; }
        .stay-hero h1 { margin:0; font-size:var(--text-title); line-height:1.15; }
        .stay-room { margin:0; font-family:var(--font-display); font-size:1.35rem; color:var(--color-ink); }
        .stay-guest { margin:0; color:var(--color-ink-soft); }
        .badge { justify-self:start; font-size:var(--text-small); font-weight:700; padding:.35rem .75rem; border-radius:999px; }
        .badge--confirmed { color:var(--color-sea-deep); background:rgb(15 106 92 / 12%); }
        .badge--checked_in { color:#1f4b7a; background:rgb(31 75 122 / 12%); }
        .stay-dates { margin:0; font-size:1.05rem; color:var(--color-ink-soft); }
        .actions { display:flex; flex-wrap:wrap; gap:var(--space-2); }
        .folio { padding:var(--space-4); border:1px solid rgb(16 36 31 / 10%); border-radius:var(--radius-sm); background:var(--color-paper-elevated); display:grid; gap:var(--space-3); }
        .folio h2 { margin:0; font-size:1.1rem; }
        .folio-note { margin:0; font-size:var(--text-small); color:var(--color-ink-soft); }
        .folio-lines { list-style:none; margin:0; padding:0; display:grid; gap:var(--space-2); }
        .folio-lines li { display:flex; justify-content:space-between; gap:var(--space-3); font-size:var(--text-small); color:var(--color-ink-soft); }
        .folio-total { margin:0; display:flex; justify-content:space-between; align-items:baseline; padding-top:var(--space-2); border-top:1px solid rgb(16 36 31 / 10%); }
        .stay-secondary { display:flex; flex-wrap:wrap; gap:var(--space-2); padding-top:var(--space-2); border-top:1px solid rgb(16 36 31 / 8%); }
        .state { margin:0; color:var(--color-ink-soft); }
        .state--error { color:var(--color-danger); }
      `}</style>
    </section>
  );
}
