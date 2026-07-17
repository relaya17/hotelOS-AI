import { useEffect, useState } from "react";
import { Button } from "@hotelos/ui";
import { listHotels, type HotelDto } from "./api-client.js";
import { clearSession, type StoredUser } from "./session.js";

export type DashboardPageProps = {
  readonly user: StoredUser;
  readonly onLogout: () => void;
};

export function DashboardPage({ user, onLogout }: DashboardPageProps) {
  const [hotels, setHotels] = useState<readonly HotelDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(undefined);
      try {
        const data = await listHotels();
        if (!cancelled) {
          setHotels(data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "שגיאה בטעינה",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  function logout() {
    clearSession();
    onLogout();
  }

  return (
    <div className="dash">
      <header className="dash__header">
        <div>
          <p className="eyebrow">HotelOS AI</p>
          <h1>לוח בקרה</h1>
          <p className="sub">
            שלום {user.displayName} · {user.roles.join(" · ")}
          </p>
        </div>
        <Button variant="ghost" type="button" onClick={logout}>
          התנתקות
        </Button>
      </header>

      <section className="card" aria-labelledby="hotels-title">
        <h2 id="hotels-title">מלונות ברשת</h2>
        <p className="hint">Multi-Hotel — כל הנכסים תחת אותו Tenant</p>

        {loading ? <p className="state">טוען מלונות…</p> : null}
        {error !== undefined ? (
          <p className="state state--error" role="alert">
            {error}
          </p>
        ) : null}

        {!loading && error === undefined ? (
          <ul className="hotel-list">
            {hotels.map((hotel, index) => (
              <li
                key={hotel.id}
                className="hotel-item"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <div>
                  <h3>{hotel.name}</h3>
                  <p>
                    {hotel.timezone} · {hotel.currency}
                  </p>
                </div>
                <span className="badge">פעיל</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <style>{`
        .dash {
          min-height: 100vh;
          padding: clamp(1.25rem, 3vw, 2.5rem);
          display: grid;
          gap: var(--space-5);
          align-content: start;
        }
        .dash__header {
          display: flex;
          justify-content: space-between;
          gap: var(--space-4);
          align-items: start;
        }
        .eyebrow {
          margin: 0 0 var(--space-2);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          font-size: var(--text-small);
          color: var(--color-sea-deep);
          font-weight: 700;
        }
        h1 {
          font-size: var(--text-display);
          margin: 0;
        }
        .sub {
          margin: var(--space-2) 0 0;
          color: var(--color-ink-soft);
        }
        .card {
          background: rgb(255 250 242 / 90%);
          border: 1px solid rgb(16 36 31 / 10%);
          border-radius: calc(var(--radius-md) + 0.1rem);
          box-shadow: var(--shadow-soft);
          padding: clamp(1.2rem, 2.5vw, 1.8rem);
          animation: rise 380ms ease both;
        }
        .card h2 {
          font-size: var(--text-title);
          margin: 0;
        }
        .hint {
          margin: var(--space-2) 0 var(--space-4);
          color: var(--color-ink-soft);
        }
        .hotel-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: var(--space-3);
        }
        .hotel-item {
          display: flex;
          justify-content: space-between;
          gap: var(--space-3);
          align-items: center;
          padding: var(--space-4);
          border: 1px solid rgb(16 36 31 / 10%);
          border-radius: var(--radius-sm);
          background: var(--color-paper-elevated);
          animation: rise 420ms ease both;
        }
        .hotel-item h3 {
          margin: 0;
          font-family: var(--font-display);
          font-size: 1.25rem;
        }
        .hotel-item p {
          margin: var(--space-1) 0 0;
          color: var(--color-ink-soft);
          font-size: var(--text-small);
        }
        .badge {
          font-size: var(--text-small);
          font-weight: 700;
          color: var(--color-sea-deep);
          background: rgb(15 106 92 / 12%);
          padding: 0.35rem 0.7rem;
          border-radius: 999px;
        }
        .state { margin: 0; color: var(--color-ink-soft); }
        .state--error { color: var(--color-danger); }
        @keyframes rise {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
