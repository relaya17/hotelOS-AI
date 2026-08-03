import { useEffect, useMemo, useState } from "react";
import {
  fetchPilotRoiMetrics,
  listHotels,
  type HotelDto,
  type PilotRoiMetricsDto,
} from "@hotelos/web-client";

const SCORECARD_DOC =
  "https://github.com/hotelos/hotel/blob/main/docs/planning/pilot-roi-scorecard.md";

type MetricRow = {
  readonly row: number;
  readonly labelHe: string;
  readonly value: string;
  readonly unit: string;
};

function formatNullableNumber(
  value: number | null,
  fractionDigits = 1,
): string {
  if (value === null) {
    return "—";
  }
  return value.toLocaleString("he-IL", {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: 0,
  });
}

function formatRate(value: number | null): string {
  if (value === null) {
    return "—";
  }
  return `${Math.round(value * 100)}%`;
}

function metricRows(metrics: PilotRoiMetricsDto): readonly MetricRow[] {
  return [
    {
      row: 1,
      labelHe: "תדריכי בוקר / CIO digest (פרוקסי — מספר חדרים שהסתיימו)",
      value: String(metrics.morningBriefingProxy),
      unit: "חדרים",
    },
    {
      row: 2,
      labelHe: "זמן חציוני לטיפול בתקלה דחופה",
      value: formatNullableNumber(metrics.medianIncidentHandleHours),
      unit: "שעות",
    },
    {
      row: 3,
      labelHe: "ממוצע דקות ניקיון חדר (waiting→ready)",
      value: formatNullableNumber(metrics.roomPrepMedianMinutes, 0),
      unit: "דקות",
    },
    {
      row: 4,
      labelHe: "משימות אוטומטיות שנוצרו",
      value: String(metrics.autoTasksCreated),
      unit: "משימות",
    },
    {
      row: 5,
      labelHe: "הצעות upsell שאושרו",
      value: String(metrics.upsellAcceptedCount),
      unit: `אושרו · ${formatRate(metrics.upsellAcceptedRate)} שיעור`,
    },
    {
      row: 6,
      labelHe: "זמן תגובה לביקורת שלילית",
      value: formatNullableNumber(metrics.negativeReviewResponseHours),
      unit: "שעות",
    },
  ];
}

export function PilotRoiPage() {
  const [hotels, setHotels] = useState<readonly HotelDto[]>([]);
  const [hotelId, setHotelId] = useState<string>("");
  const [windowDays, setWindowDays] = useState(30);
  const [metrics, setMetrics] = useState<PilotRoiMetricsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    void listHotels()
      .then((list) => {
        if (cancelled) return;
        setHotels(list);
        if (list.length > 0) {
          setHotelId((current) => current || list[0]!.id);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("לא ניתן לטעון רשימת מלונות");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hotelId) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    void fetchPilotRoiMetrics({ hotelId, windowDays })
      .then((data) => {
        if (!cancelled) {
          setMetrics(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("לא ניתן לטעון מדדי פיילוט");
          setMetrics(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [hotelId, windowDays]);

  const rows = useMemo(
    () => (metrics ? metricRows(metrics) : []),
    [metrics],
  );

  const scopeLabel =
    metrics?.hotelName ??
    (hotelId ? hotels.find((h) => h.id === hotelId)?.name : null) ??
    "רשת";

  return (
    <section className="pilot-roi" aria-labelledby="pilot-roi-heading">
      <header className="pilot-roi__header">
        <div>
          <h1 id="pilot-roi-heading">מדדי פיילוט / ROI</h1>
          <p className="pilot-roi__lead">
            מדדים תפעוליים חיים מהמערכת — ללא השוואה אוטומטית ל-baseline.
            מלאו baseline ידנית ב
            <a href={SCORECARD_DOC} rel="noopener noreferrer">
              גיליון הפיילוט
            </a>
            .
          </p>
        </div>
        <div className="pilot-roi__filters">
          <label htmlFor="pilot-roi-hotel">
            <span>מלון</span>
            <select
              id="pilot-roi-hotel"
              className="hotelos-select"
              value={hotelId}
              onChange={(event) => setHotelId(event.target.value)}
            >
              {hotels.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>
                  {hotel.name}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="pilot-roi-window">
            <span>חלון (ימים)</span>
            <select
              id="pilot-roi-window"
              className="hotelos-select"
              value={windowDays}
              onChange={(event) => setWindowDays(Number(event.target.value))}
            >
              {[7, 30, 60, 90].map((days) => (
                <option key={days} value={days}>
                  {days}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {loading ? (
        <p role="status" aria-live="polite">
          טוען מדדים…
        </p>
      ) : null}
      {error ? (
        <p className="pilot-roi__error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && metrics ? (
        <>
          <p className="pilot-roi__meta">
            {scopeLabel} · {metrics.windowDays} ימים אחרונים · עודכן{" "}
            {new Date(metrics.generatedAt).toLocaleString("he-IL")}
          </p>

          <div className="pilot-roi__table-wrap">
            <table className="pilot-roi__table">
              <caption className="sr">
                מדדי פיילוט ROI לפי גיליון scorecard
              </caption>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">מדד</th>
                  <th scope="col">ערך נוכחי</th>
                  <th scope="col">יחידה</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.row}>
                    <td>{row.row}</td>
                    <td>{row.labelHe}</td>
                    <td>{row.value}</td>
                    <td>{row.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {metrics.notesHe.length > 0 ? (
            <aside className="pilot-roi__notes" aria-labelledby="pilot-roi-notes">
              <h2 id="pilot-roi-notes">הערות ופרוקסי</h2>
              <ul>
                {metrics.notesHe.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </aside>
          ) : null}
        </>
      ) : null}

      <style>{`
        .pilot-roi { padding: clamp(1rem, 3vw, 2rem); max-width: 960px; margin: 0 auto; }
        .pilot-roi__header { display: flex; flex-wrap: wrap; gap: var(--space-4); justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-4); }
        .pilot-roi__lead { color: var(--color-ink-muted); max-width: 42rem; line-height: 1.5; }
        .pilot-roi__lead a { color: var(--color-sea-deep); font-weight: 600; margin-inline-start: .25rem; }
        .pilot-roi__filters { display: flex; flex-wrap: wrap; gap: var(--space-3); }
        .pilot-roi__filters label { display: grid; gap: .35rem; font-size: var(--text-small); font-weight: 600; }
        .pilot-roi__meta { font-size: var(--text-small); color: var(--color-ink-faint); margin-bottom: var(--space-3); }
        .pilot-roi__table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; border: 1px solid var(--color-border); border-radius: var(--radius-md); }
        .pilot-roi__table { width: 100%; border-collapse: collapse; min-width: 32rem; }
        .pilot-roi__table th, .pilot-roi__table td { padding: .75rem 1rem; text-align: start; border-bottom: 1px solid var(--color-border); vertical-align: top; }
        .pilot-roi__table th { background: var(--color-surface-muted); font-size: var(--text-small); }
        .pilot-roi__table tr:last-child td { border-bottom: none; }
        .pilot-roi__notes { margin-top: var(--space-4); padding: var(--space-3); background: var(--color-surface-muted); border-radius: var(--radius-md); }
        .pilot-roi__notes h2 { font-size: 1rem; margin-bottom: var(--space-2); }
        .pilot-roi__notes ul { margin: 0; padding-inline-start: 1.25rem; display: grid; gap: .5rem; }
        .pilot-roi__error { color: var(--color-danger); }
        .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
        @media (max-width: 640px) {
          .pilot-roi__header { flex-direction: column; }
          .pilot-roi__filters { width: 100%; }
          .pilot-roi__filters select { width: 100%; min-height: 2.75rem; }
        }
      `}</style>
    </section>
  );
}
