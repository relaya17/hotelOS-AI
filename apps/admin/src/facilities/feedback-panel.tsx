import { useEffect, useState } from "react";
import { fetchOpsFeedback, type GuestFeedbackDto } from "@hotelos/web-client";

export type FeedbackPanelProps = {
  readonly hotelId: string;
};

export function FeedbackPanel({ hotelId }: FeedbackPanelProps) {
  const [items, setItems] = useState<readonly GuestFeedbackDto[]>([]);
  const [average, setAverage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(undefined);
      try {
        const data = await fetchOpsFeedback(hotelId);
        if (!cancelled) {
          setItems(data.items);
          setAverage(data.average);
        }
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
  }, [hotelId]);

  return (
    <div className="panel">
      {loading ? <p className="state">טוען משוב אורחים…</p> : null}
      {error !== undefined ? (
        <p className="state state--error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="card">
        <div className="card__header">
          <h2>משוב אורחים</h2>
          {average !== null ? (
            <span className="avg">
              ⭐ {average.toFixed(1)} <small>/ 5</small>
            </span>
          ) : null}
        </div>
        <p className="hint">
          נאסף דרך סקר שביעות רצון באפליקציית האורח (Guest App) בסיום השהייה.
        </p>
        {!loading && items.length === 0 ? (
          <p className="hint">עדיין לא התקבל משוב עבור מלון זה.</p>
        ) : null}
        <ul className="list">
          {items.map((item) => (
            <li key={item.id} className="row">
              <div>
                <h3>דירוג: {item.rating} / 5</h3>
                {item.comment ? <p>{item.comment}</p> : null}
                {item.categories.length > 0 ? (
                  <p className="meta">{item.categories.join(" · ")}</p>
                ) : null}
              </div>
              <span className="meta">{item.submittedAt.slice(0, 10)}</span>
            </li>
          ))}
        </ul>
      </section>

      <style>{`
        .panel { display:grid; gap:var(--space-4); }
        .card { background:rgb(255 250 242 / 90%); border:1px solid rgb(16 36 31 / 10%); border-radius:calc(var(--radius-md) + .1rem); box-shadow:var(--shadow-soft); padding:clamp(1.2rem,2.5vw,1.8rem); display:grid; gap:var(--space-4); }
        .card__header { display:flex; justify-content:space-between; align-items:center; }
        .card h2 { margin:0; font-size:var(--text-title); }
        .avg { font-size:1.4rem; font-weight:700; color:var(--color-sea-deep); }
        .avg small { color:var(--color-ink-soft); font-weight:500; font-size:var(--text-small); }
        .hint { margin:0; color:var(--color-ink-soft); }
        .list { list-style:none; margin:0; padding:0; display:grid; gap:var(--space-3); }
        .row { display:flex; justify-content:space-between; gap:var(--space-3); align-items:flex-start; padding:var(--space-4); border:1px solid rgb(16 36 31 / 10%); border-radius:var(--radius-sm); background:var(--color-paper-elevated); }
        .row h3 { margin:0; font-family:var(--font-display); font-size:1.05rem; }
        .row p { margin:var(--space-1) 0 0; color:var(--color-ink-soft); font-size:var(--text-small); }
        .meta { color:var(--color-ink-soft); font-size:var(--text-small); }
        .state { margin:0; color:var(--color-ink-soft); }
        .state--error { color:var(--color-danger); }
      `}</style>
    </div>
  );
}
