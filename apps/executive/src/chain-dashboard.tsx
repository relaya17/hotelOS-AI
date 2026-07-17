import { useEffect, useState } from "react";
import { Button } from "@hotelos/ui";
import {
  APP_URLS,
  clearSession,
  fetchChainOverview,
  type ChainOverviewDto,
  type StoredUser,
} from "@hotelos/web-client";

export type ChainDashboardProps = {
  readonly user: StoredUser;
  readonly onLogout: () => void;
};

export function ChainDashboard({ user, onLogout }: ChainDashboardProps) {
  const [overview, setOverview] = useState<ChainOverviewDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(undefined);
      try {
        const data = await fetchChainOverview();
        if (!cancelled) setOverview(data);
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

  const totals = overview?.hotels.reduce(
    (acc, hotel) => ({
      rooms: acc.rooms + hotel.rooms.total,
      occupied: acc.occupied + hotel.rooms.occupied,
      dirty: acc.dirty + hotel.rooms.dirty,
      activeBookings: acc.activeBookings + hotel.bookings.active,
    }),
    { rooms: 0, occupied: 0, dirty: 0, activeBookings: 0 },
  );

  return (
    <div className="dash">
      <header className="dash__header">
        <div>
          <p className="eyebrow">Executive · רמת רשת</p>
          <h1>{overview?.tenantName ?? "לוח בקרה לרשת"}</h1>
          <p className="sub">
            {user.displayName} · {overview?.hotelCount ?? "—"} מלונות ברשת
          </p>
        </div>
        <div className="actions">
          <a className="link" href={APP_URLS.admin}>
            תפעול מלון
          </a>
          <Button
            variant="ghost"
            type="button"
            onClick={() => {
              clearSession();
              onLogout();
            }}
          >
            התנתקות
          </Button>
        </div>
      </header>

      {totals ? (
        <section className="kpi-row" aria-label="סיכום רשת">
          <article className="kpi">
            <p>מלונות</p>
            <strong>{overview?.hotelCount}</strong>
          </article>
          <article className="kpi">
            <p>חדרים ברשת</p>
            <strong>{totals.rooms}</strong>
          </article>
          <article className="kpi">
            <p>תפוסים כעת</p>
            <strong>{totals.occupied}</strong>
          </article>
          <article className="kpi">
            <p>הזמנות פעילות</p>
            <strong>{totals.activeBookings}</strong>
          </article>
        </section>
      ) : null}

      <section className="card">
        <h2>בתי מלון ברשת</h2>
        <p className="hint">
          מבט-על לכל הנכסים. לתפעול יומיומי (חדרים/הזמנות) עברו לאפליקציית Admin
          הנפרדת.
        </p>
        {loading ? <p className="state">טוען…</p> : null}
        {error !== undefined ? (
          <p className="state state--error" role="alert">
            {error}
          </p>
        ) : null}
        {overview ? (
          <ul className="hotel-grid">
            {overview.hotels.map((hotel) => {
              const occ =
                hotel.rooms.total === 0
                  ? 0
                  : Math.round(
                      (hotel.rooms.occupied / hotel.rooms.total) * 100,
                    );
              return (
                <li key={hotel.id} className="hotel-card">
                  <div>
                    <h3>{hotel.name}</h3>
                    <p>
                      {hotel.timezone} · {hotel.currency}
                    </p>
                  </div>
                  <dl className="metrics">
                    <div>
                      <dt>תפוסה</dt>
                      <dd>{occ}%</dd>
                    </div>
                    <div>
                      <dt>פנויים</dt>
                      <dd>{hotel.rooms.vacant}</dd>
                    </div>
                    <div>
                      <dt>לניקיון</dt>
                      <dd>{hotel.rooms.dirty}</dd>
                    </div>
                    <div>
                      <dt>הזמנות פעילות</dt>
                      <dd>{hotel.bookings.active}</dd>
                    </div>
                  </dl>
                  <a
                    className="open-ops"
                    href={`${APP_URLS.admin}?hotelId=${hotel.id}`}
                  >
                    פתח תפעול מלון
                  </a>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      <style>{`
        .dash { min-height:100vh; padding:clamp(1.25rem,3vw,2.5rem); display:grid; gap:var(--space-5); align-content:start; }
        .dash__header { display:flex; justify-content:space-between; gap:var(--space-4); align-items:start; }
        .actions { display:flex; gap:var(--space-3); align-items:center; }
        .link { color:var(--color-sea-deep); font-weight:600; }
        .eyebrow { margin:0 0 var(--space-2); letter-spacing:.08em; text-transform:uppercase; font-size:var(--text-small); color:var(--color-sea-deep); font-weight:700; }
        h1 { font-size:var(--text-display); margin:0; }
        .sub { margin:var(--space-2) 0 0; color:var(--color-ink-soft); }
        .kpi-row { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:var(--space-3); }
        .kpi { background:rgb(255 250 242 / 90%); border:1px solid rgb(16 36 31 / 10%); border-radius:var(--radius-md); padding:var(--space-4); box-shadow:var(--shadow-soft); }
        .kpi p { margin:0; color:var(--color-ink-soft); font-size:var(--text-small); }
        .kpi strong { display:block; margin-top:var(--space-2); font-family:var(--font-display); font-size:2rem; }
        .card { background:rgb(255 250 242 / 90%); border:1px solid rgb(16 36 31 / 10%); border-radius:calc(var(--radius-md) + .1rem); box-shadow:var(--shadow-soft); padding:clamp(1.2rem,2.5vw,1.8rem); }
        .card h2 { margin:0; font-size:var(--text-title); }
        .hint { margin:var(--space-2) 0 var(--space-4); color:var(--color-ink-soft); }
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
        @media (max-width:900px){ .kpi-row{ grid-template-columns:1fr 1fr; } }
      `}</style>
    </div>
  );
}
