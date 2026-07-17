import { useEffect, useState } from "react";
import {
  APP_URLS,
  fetchDailyBriefing,
  fetchOpsDashboard,
  type DailyBriefingHotelDto,
  type OpsDashboardHotelDto,
} from "@hotelos/web-client";

export function OpsDashboardPage() {
  const [hotels, setHotels] = useState<readonly OpsDashboardHotelDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const [briefingHotels, setBriefingHotels] = useState<
    readonly DailyBriefingHotelDto[]
  >([]);
  const [chainSummaryHe, setChainSummaryHe] = useState<string | undefined>();
  const [briefingLoading, setBriefingLoading] = useState(true);
  const [briefingError, setBriefingError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(undefined);
      try {
        const data = await fetchOpsDashboard();
        if (!cancelled) setHotels(data.hotels);
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
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadBriefing() {
      setBriefingLoading(true);
      setBriefingError(undefined);
      try {
        const data = await fetchDailyBriefing();
        if (cancelled) return;
        setBriefingHotels(data.hotels);
        setChainSummaryHe(data.chainSummaryHe ?? undefined);
      } catch (loadError) {
        if (!cancelled) {
          setBriefingError(
            loadError instanceof Error ? loadError.message : "שגיאה בטעינת התדריך",
          );
        }
      } finally {
        if (!cancelled) setBriefingLoading(false);
      }
    }
    void loadBriefing();
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = hotels.reduce(
    (acc, hotel) => ({
      openMaintenanceRequests: acc.openMaintenanceRequests + hotel.openMaintenanceRequests,
      pendingQuoteRequests: acc.pendingQuoteRequests + hotel.pendingQuoteRequests,
      lowStockItems: acc.lowStockItems + hotel.lowStockItems,
      openPurchaseOrders: acc.openPurchaseOrders + hotel.openPurchaseOrders,
    }),
    { openMaintenanceRequests: 0, pendingQuoteRequests: 0, lowStockItems: 0, openPurchaseOrders: 0 },
  );

  const ratedHotels = hotels.filter((hotel) => hotel.averageFeedbackRating !== null);
  const overallRating =
    ratedHotels.length > 0
      ? Math.round(
          (ratedHotels.reduce(
            (sum, hotel) => sum + (hotel.averageFeedbackRating ?? 0),
            0,
          ) /
            ratedHotels.length) *
            10,
        ) / 10
      : null;

  return (
    <div className="ops-dash">
      <header className="ops-dash__header">
        <div>
          <p className="eyebrow">מבט-על תפעולי · כל המחלקות</p>
          <h1>לוח בקרה תפעולי מאוחד</h1>
          <p className="sub">
            תחזוקה, רכש, מלאי ומשוב אורחים — בתמונה אחת לכל בתי המלון ברשת.
          </p>
        </div>
      </header>

      <section className="card briefing-card">
        <h2>תדריך יומי לרשת</h2>
        {briefingLoading ? <p className="state">מכין תדריך…</p> : null}
        {briefingError !== undefined ? (
          <p className="state state--error" role="alert">
            {briefingError}
          </p>
        ) : null}
        {!briefingLoading && !briefingError && chainSummaryHe ? (
          <p className="chain-summary">{chainSummaryHe}</p>
        ) : null}
        {!briefingLoading && !briefingError && briefingHotels.length === 0 ? (
          <p className="hint">אין עדיין נתונים מספיקים לתדריך.</p>
        ) : null}
        {!briefingLoading && briefingHotels.length > 0 ? (
          <ul className="briefing-list">
            {briefingHotels.map((hotel) => (
              <li key={hotel.hotelId}>
                <strong>{hotel.hotelName}:</strong> {hotel.summaryHe}
                {hotel.warnings.length > 0 ? (
                  <ul className="briefing-warnings">
                    {hotel.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {loading ? <p className="state">טוען…</p> : null}
      {error !== undefined ? (
        <p className="state state--error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && hotels.length > 0 ? (
        <section className="kpi-row" aria-label="סיכום תפעולי">
          <article className="kpi">
            <p>קריאות תחזוקה פתוחות</p>
            <strong>{totals.openMaintenanceRequests}</strong>
          </article>
          <article className="kpi">
            <p>ממתינות להצעת מחיר</p>
            <strong>{totals.pendingQuoteRequests}</strong>
          </article>
          <article className="kpi">
            <p>פריטי מלאי מתחת לסף</p>
            <strong>{totals.lowStockItems}</strong>
          </article>
          <article className="kpi">
            <p>הזמנות רכש פתוחות</p>
            <strong>{totals.openPurchaseOrders}</strong>
          </article>
          <article className="kpi">
            <p>דירוג משוב ממוצע</p>
            <strong>{overallRating !== null ? `⭐ ${overallRating.toFixed(1)}` : "—"}</strong>
          </article>
        </section>
      ) : null}

      <section className="card">
        <h2>לפי בית מלון</h2>
        {!loading && hotels.length === 0 ? (
          <p className="hint">אין נתונים תפעוליים עדיין.</p>
        ) : null}
        <ul className="hotel-grid">
          {hotels.map((hotel) => (
            <li key={hotel.hotelId} className="hotel-card">
              <div>
                <h3>{hotel.hotelName}</h3>
                <p>{hotel.departmentCount} מחלקות</p>
              </div>
              <dl className="metrics">
                <div>
                  <dt>תחזוקה פתוחה</dt>
                  <dd>{hotel.openMaintenanceRequests}</dd>
                </div>
                <div>
                  <dt>ממתין להצעה</dt>
                  <dd>{hotel.pendingQuoteRequests}</dd>
                </div>
                <div>
                  <dt>מלאי חסר</dt>
                  <dd>{hotel.lowStockItems}</dd>
                </div>
                <div>
                  <dt>הזמנות רכש</dt>
                  <dd>{hotel.openPurchaseOrders}</dd>
                </div>
                <div>
                  <dt>דירוג אורחים</dt>
                  <dd>
                    {hotel.averageFeedbackRating !== null
                      ? `⭐ ${hotel.averageFeedbackRating.toFixed(1)}`
                      : "—"}
                  </dd>
                </div>
              </dl>
              <a
                className="open-ops"
                href={`${APP_URLS.admin}?hotelId=${hotel.hotelId}`}
              >
                פתח תפעול מלון זה
              </a>
            </li>
          ))}
        </ul>
      </section>

      <style>{`
        .ops-dash { display:grid; gap:var(--space-5); align-content:start; }
        .ops-dash__header { display:flex; justify-content:space-between; gap:var(--space-4); align-items:start; }
        .eyebrow { margin:0 0 var(--space-2); letter-spacing:.08em; text-transform:uppercase; font-size:var(--text-small); color:var(--color-sea-deep); font-weight:700; }
        h1 { font-size:var(--text-display); margin:0; }
        .sub { margin:var(--space-2) 0 0; color:var(--color-ink-soft); max-width:60ch; }
        .kpi-row { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:var(--space-3); }
        .kpi { background:rgb(255 250 242 / 90%); border:1px solid rgb(16 36 31 / 10%); border-radius:var(--radius-md); padding:var(--space-4); box-shadow:var(--shadow-soft); }
        .kpi p { margin:0; color:var(--color-ink-soft); font-size:var(--text-small); }
        .kpi strong { display:block; margin-top:var(--space-2); font-family:var(--font-display); font-size:1.7rem; }
        .card { background:rgb(255 250 242 / 90%); border:1px solid rgb(16 36 31 / 10%); border-radius:calc(var(--radius-md) + .1rem); box-shadow:var(--shadow-soft); padding:clamp(1.2rem,2.5vw,1.8rem); }
        .card h2 { margin:0 0 var(--space-3); font-size:var(--text-title); }
        .hint { margin:0; color:var(--color-ink-soft); }
        .briefing-card { border-color:rgb(16 36 31 / 14%); }
        .chain-summary { margin:0 0 var(--space-3); font-weight:600; }
        .briefing-list { margin:0; padding-inline-start:1.2rem; display:grid; gap:var(--space-2); }
        .briefing-warnings { margin:.3rem 0 0; padding-inline-start:1.1rem; display:grid; gap:.2rem; font-size:var(--text-small); color:#b3541e; }
        .hotel-grid { list-style:none; margin:0; padding:0; display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:var(--space-4); }
        .hotel-card { display:grid; gap:var(--space-3); padding:var(--space-4); border:1px solid rgb(16 36 31 / 10%); border-radius:var(--radius-sm); background:var(--color-paper-elevated); }
        .hotel-card h3 { margin:0; font-family:var(--font-display); }
        .hotel-card > div > p { margin:var(--space-1) 0 0; color:var(--color-ink-soft); font-size:var(--text-small); }
        .metrics { margin:0; display:grid; grid-template-columns:1fr 1fr; gap:var(--space-2); }
        .metrics div { display:grid; gap:.15rem; }
        .metrics dt { font-size:var(--text-small); color:var(--color-ink-soft); }
        .metrics dd { margin:0; font-weight:700; }
        .open-ops { display:inline-block; font-weight:700; color:var(--color-sea-deep); }
        .state { margin:0; color:var(--color-ink-soft); }
        .state--error { color:var(--color-danger); }
        @media (max-width:1100px){ .kpi-row{ grid-template-columns:repeat(3,minmax(0,1fr)); } }
        @media (max-width:640px){ .kpi-row{ grid-template-columns:1fr 1fr; } }
      `}</style>
    </div>
  );
}
