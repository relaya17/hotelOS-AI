import { useEffect, useState } from "react";
import { fetchDailyBriefing, type DailyBriefingHotelDto } from "@hotelos/web-client";

type Props = {
  readonly hotelId: string;
};

export function DailyBriefingPanel({ hotelId }: Props) {
  const [section, setSection] = useState<DailyBriefingHotelDto | undefined>();
  const [generatedAt, setGeneratedAt] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(undefined);
      try {
        const data = await fetchDailyBriefing();
        if (cancelled) return;
        setGeneratedAt(data.generatedAt);
        setSection(data.hotels.find((hotel) => hotel.hotelId === hotelId));
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "שגיאה בטעינת התדריך",
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
  }, [hotelId]);

  return (
    <div className="briefing">
      <header className="briefing__header">
        <div>
          <p className="eyebrow">תדריך יומי · עוזר תפעולי</p>
          <h2>מה חשוב לדעת היום</h2>
        </div>
        {generatedAt ? (
          <p className="generated">
            עודכן: {new Date(generatedAt).toLocaleString("he-IL")}
          </p>
        ) : null}
      </header>

      {loading ? <p className="state">מכין תדריך…</p> : null}
      {error !== undefined ? (
        <p className="state state--error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && !section ? (
        <p className="state">אין עדיין נתונים מספיקים לתדריך למלון הזה.</p>
      ) : null}

      {section ? (
        <div className="briefing__body">
          <p className="summary">{section.summaryHe}</p>

          <div className="metrics">
            <div>
              <dt>תפוסה</dt>
              <dd>{section.occupancyPercent}%</dd>
            </div>
            <div>
              <dt>הזמנות פעילות</dt>
              <dd>{section.activeBookings}</dd>
            </div>
            <div>
              <dt>חדרים לניקיון</dt>
              <dd>{section.roomsNeedingCleaning}</dd>
            </div>
            <div>
              <dt>תחזוקה פתוחה</dt>
              <dd>{section.openMaintenanceRequests}</dd>
            </div>
            <div>
              <dt>דירוג אורחים</dt>
              <dd>
                {section.averageFeedbackRating !== null
                  ? `⭐ ${section.averageFeedbackRating.toFixed(1)}`
                  : "—"}
              </dd>
            </div>
          </div>

          {section.warnings.length > 0 ? (
            <section className="list-block list-block--warn">
              <h3>דורש תשומת לב</h3>
              <ul>
                {section.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {section.highlights.length > 0 ? (
            <section className="list-block list-block--good">
              <h3>נקודות טובות</h3>
              <ul>
                {section.highlights.map((highlight) => (
                  <li key={highlight}>{highlight}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {section.suggestedActions.length > 0 ? (
            <section className="list-block list-block--action">
              <h3>מומלץ לעשות היום</h3>
              <ul>
                {section.suggestedActions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      <style>{`
        .briefing { display:grid; gap:var(--space-4); }
        .briefing__header { display:flex; justify-content:space-between; align-items:flex-end; gap:var(--space-3); flex-wrap:wrap; }
        .eyebrow { margin:0 0 var(--space-2); letter-spacing:.08em; text-transform:uppercase; font-size:var(--text-small); color:var(--color-sea-deep); font-weight:700; }
        h2 { margin:0; font-size:var(--text-title); font-family:var(--font-display); }
        .generated { margin:0; color:var(--color-ink-soft); font-size:var(--text-small); }
        .state { margin:0; color:var(--color-ink-soft); }
        .state--error { color:var(--color-danger); }
        .briefing__body { display:grid; gap:var(--space-4); background:rgb(255 250 242 / 90%); border:1px solid rgb(16 36 31 / 10%); border-radius:var(--radius-md); padding:clamp(1.2rem,2.5vw,1.8rem); box-shadow:var(--shadow-soft); }
        .summary { margin:0; font-weight:600; font-size:1.05rem; }
        .metrics { margin:0; display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:var(--space-3); }
        .metrics div { display:grid; gap:.15rem; background:var(--color-paper-elevated); border:1px solid rgb(16 36 31 / 8%); border-radius:var(--radius-sm); padding:var(--space-3); }
        .metrics dt { margin:0; font-size:var(--text-small); color:var(--color-ink-soft); }
        .metrics dd { margin:0; font-weight:700; font-size:1.1rem; }
        .list-block { display:grid; gap:var(--space-2); }
        .list-block h3 { margin:0; font-size:var(--text-small); text-transform:uppercase; letter-spacing:.06em; }
        .list-block ul { margin:0; padding-inline-start:1.2rem; display:grid; gap:.35rem; }
        .list-block--warn h3 { color:#b3541e; }
        .list-block--good h3 { color:var(--color-sea-deep); }
        .list-block--action h3 { color:var(--color-ink-soft); }
        @media (max-width:900px){ .metrics{ grid-template-columns:repeat(2,minmax(0,1fr)); } }
      `}</style>
    </div>
  );
}
