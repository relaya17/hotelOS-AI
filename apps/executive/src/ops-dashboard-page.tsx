import { useEffect, useState } from "react";
import {
  APP_URLS,
  fetchDailyBriefing,
  fetchOpsDashboard,
  fetchOpsForecast,
  fetchReputationReviews,
  type DailyBriefingHotelDto,
  type OpsDashboardHotelDto,
  type OpsForecastDto,
  type ReputationReviewDto,
} from "@hotelos/web-client";

export function OpsDashboardPage() {
  const [hotels, setHotels] = useState<readonly OpsDashboardHotelDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const [negativeReviews, setNegativeReviews] = useState<
    readonly ReputationReviewDto[]
  >([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState<string | undefined>();

  const [briefingHotels, setBriefingHotels] = useState<
    readonly DailyBriefingHotelDto[]
  >([]);
  const [chainSummaryHe, setChainSummaryHe] = useState<string | undefined>();
  const [briefingLoading, setBriefingLoading] = useState(true);
  const [briefingError, setBriefingError] = useState<string | undefined>();

  const [forecast, setForecast] = useState<OpsForecastDto | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState<string | undefined>();

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
    if (hotels.length === 0) {
      setNegativeReviews([]);
      setReviewsLoading(false);
      return;
    }
    let cancelled = false;
    async function loadReviews() {
      setReviewsLoading(true);
      setReviewsError(undefined);
      try {
        const batches = await Promise.all(
          hotels.map((hotel) =>
            fetchReputationReviews(hotel.hotelId, {
              sentiment: "negative",
              limit: 5,
            }),
          ),
        );
        if (cancelled) return;
        const merged = batches
          .flat()
          .sort(
            (a, b) =>
              Date.parse(b.reviewedAt) - Date.parse(a.reviewedAt),
          )
          .slice(0, 8);
        setNegativeReviews(merged);
      } catch (loadError) {
        if (!cancelled) {
          setReviewsError(
            loadError instanceof Error
              ? loadError.message
              : "שגיאה בטעינת ביקורות",
          );
        }
      } finally {
        if (!cancelled) setReviewsLoading(false);
      }
    }
    void loadReviews();
    return () => {
      cancelled = true;
    };
  }, [hotels]);

  useEffect(() => {
    const hotelId = hotels[0]?.hotelId;
    if (!hotelId) {
      setForecast(null);
      return;
    }
    let cancelled = false;
    async function loadForecast() {
      if (!hotelId) return;
      setForecastLoading(true);
      setForecastError(undefined);
      try {
        const data = await fetchOpsForecast(hotelId);
        if (!cancelled) setForecast(data);
      } catch (loadError) {
        if (!cancelled) {
          setForecastError(
            loadError instanceof Error ? loadError.message : "שגיאה בטעינת תחזית",
          );
        }
      } finally {
        if (!cancelled) setForecastLoading(false);
      }
    }
    void loadForecast();
    return () => {
      cancelled = true;
    };
  }, [hotels]);

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
          <p className="hotelos-eyebrow">מבט-על תפעולי · כל המחלקות</p>
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

      <section className="card forecast-card">
        <h2>תחזית 7 ימים</h2>
        <p className="hint">
          {forecast?.hotelName ?? hotels[0]?.hotelName ?? "מלון ראשון ברשת"} —
          הגעות, יציאות ותפוסה משוערת.
        </p>
        {forecastLoading ? <p className="state">טוען תחזית…</p> : null}
        {forecastError !== undefined ? (
          <p className="state state--error" role="alert">
            {forecastError}
          </p>
        ) : null}
        {!forecastLoading && forecast ? (
          <ul className="briefing-list">
            {forecast.summaryBulletsHe.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="card reputation-card" aria-labelledby="reputation-heading">
        <h2 id="reputation-heading">ביקורות שליליות אחרונות</h2>
        <p className="hint">
          Google / Booking / TripAdvisor — ביקורות שיצרו משימת קבלה או דורשות מעקב.
        </p>
        {reviewsLoading ? <p className="state">טוען ביקורות…</p> : null}
        {reviewsError !== undefined ? (
          <p className="state state--error" role="alert">
            {reviewsError}
          </p>
        ) : null}
        {!reviewsLoading && !reviewsError && negativeReviews.length === 0 ? (
          <p className="hint">אין ביקורות שליליות אחרונות.</p>
        ) : null}
        {!reviewsLoading && negativeReviews.length > 0 ? (
          <ul className="reputation-list">
            {negativeReviews.map((review) => {
              const hotel = hotels.find((item) => item.hotelId === review.hotelId);
              const preview =
                review.title !== null && review.title.length > 0
                  ? review.title
                  : review.body.slice(0, 120);
              return (
                <li key={review.id} className="reputation-item">
                  <div className="reputation-item__meta">
                    <span className="reputation-source">{review.source}</span>
                    <span aria-label={`דירוג ${review.rating} מתוך 5`}>
                      {"⭐".repeat(review.rating)}
                    </span>
                    {hotel !== undefined ? (
                      <span className="reputation-hotel">{hotel.hotelName}</span>
                    ) : null}
                  </div>
                  <p className="reputation-preview">{preview}</p>
                  <div className="reputation-item__actions">
                    {review.reviewUrl !== null ? (
                      <a
                        href={review.reviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        צפה במקור
                      </a>
                    ) : null}
                    {review.taskId !== null ? (
                      <a
                        href={`${APP_URLS.admin}?hotelId=${review.hotelId}&panel=departments`}
                      >
                        פתח משימת קבלה
                      </a>
                    ) : null}
                  </div>
                </li>
              );
            })}
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
              <div className="hotel-card__links">
                <a
                  className="open-ops"
                  href={`${APP_URLS.admin}?hotelId=${hotel.hotelId}`}
                >
                  פתח תפעול מלון זה
                </a>
                <a
                  className="open-ops open-ops--twin"
                  href={`${APP_URLS.admin}?hotelId=${hotel.hotelId}&panel=twin`}
                >
                  Digital Twin
                </a>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <style>{`
        .ops-dash { display:grid; gap:var(--space-5); align-content:start; animation:hotelos-enter var(--motion-med) var(--ease-out) both; }
        .ops-dash__header { display:flex; justify-content:space-between; gap:var(--space-4); align-items:start; }
        .ops-dash__header .hotelos-eyebrow { margin-bottom:var(--space-2); }
        h1 { font-size:var(--text-display); margin:0; }
        .sub { margin:var(--space-2) 0 0; color:var(--color-ink-soft); max-width:60ch; font-weight:500; }
        .kpi-row { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:var(--space-3); }
        .kpi { background:var(--color-paper-elevated); border:1px solid var(--color-line); border-radius:var(--radius-md); padding:var(--space-4); box-shadow:var(--shadow-soft); }
        .kpi p { margin:0; color:var(--color-ink-soft); font-size:var(--text-small); font-weight:500; }
        .kpi strong { display:block; margin-top:var(--space-2); font-family:var(--font-display); font-size:1.7rem; letter-spacing:var(--tracking-display); }
        .card { background:var(--color-paper-elevated); border:1px solid var(--color-line); border-radius:var(--radius-md); box-shadow:var(--shadow-soft); padding:clamp(1.2rem,2.5vw,1.8rem); }
        .card h2 { margin:0 0 var(--space-3); font-size:var(--text-title); }
        .hint { margin:0; color:var(--color-ink-soft); font-weight:500; }
        .briefing-card { border-color:var(--color-line-strong); }
        .chain-summary { margin:0 0 var(--space-3); font-weight:600; }
        .briefing-list { margin:0; padding-inline-start:1.2rem; display:grid; gap:var(--space-2); }
        .briefing-warnings { margin:.3rem 0 0; padding-inline-start:1.1rem; display:grid; gap:.2rem; font-size:var(--text-small); color:var(--color-warn); }
        .reputation-card { border-color:var(--color-line-strong); }
        .reputation-list { list-style:none; margin:var(--space-3) 0 0; padding:0; display:grid; gap:var(--space-3); }
        .reputation-item { padding:var(--space-3); border:1px solid var(--color-line); border-radius:var(--radius-sm); background:var(--color-paper); }
        .reputation-item__meta { display:flex; flex-wrap:wrap; gap:var(--space-2); align-items:center; font-size:var(--text-small); color:var(--color-ink-soft); }
        .reputation-source { font-weight:700; text-transform:capitalize; color:var(--color-sea-deep); }
        .reputation-hotel { font-weight:600; }
        .reputation-preview { margin:var(--space-2) 0 0; font-weight:500; }
        .reputation-item__actions { display:flex; flex-wrap:wrap; gap:var(--space-3); margin-top:var(--space-2); }
        .reputation-item__actions a { font-weight:700; color:var(--color-sea-deep); }
        .hotel-grid { list-style:none; margin:0; padding:0; display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:var(--space-4); }
        .hotel-card { display:grid; gap:var(--space-3); padding:var(--space-4); border:1px solid var(--color-line); border-radius:var(--radius-md); background:var(--color-paper-elevated); box-shadow:var(--shadow-soft); }
        .hotel-card h3 { margin:0; }
        .hotel-card > div > p { margin:var(--space-1) 0 0; color:var(--color-ink-soft); font-size:var(--text-small); }
        .metrics { margin:0; display:grid; grid-template-columns:1fr 1fr; gap:var(--space-2); }
        .metrics div { display:grid; gap:.15rem; }
        .metrics dt { font-size:var(--text-small); color:var(--color-ink-soft); }
        .metrics dd { margin:0; font-weight:700; }
        .hotel-card__links { display:flex; flex-wrap:wrap; gap:var(--space-3); align-items:center; }
        .open-ops { display:inline-block; font-weight:700; color:var(--color-sea-deep); }
        .open-ops--twin { font-weight:600; opacity:0.9; }
        .state { margin:0; color:var(--color-ink-soft); font-weight:500; }
        .state--error { color:var(--color-danger); }
        @media (max-width:1100px){ .kpi-row{ grid-template-columns:repeat(3,minmax(0,1fr)); } }
        @media (max-width:640px){
          .ops-dash__header{ flex-direction:column; }
          h1{ font-size:clamp(1.35rem,6vw,2rem); word-break:break-word; }
          .kpi-row{ grid-template-columns:1fr 1fr; }
          .hotel-grid{ grid-template-columns:1fr; }
        }
      `}</style>
    </div>
  );
}
