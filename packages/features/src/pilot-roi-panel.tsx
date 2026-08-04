import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchPilotRoiMetrics,
  listHotels,
  type HotelDto,
  type PilotRoiMetricsDto,
} from "@hotelos/web-client";
import {
  computeMetricDelta,
  metricCurrentValue,
  readPilotRoiBaseline,
  readPilotRoiNotes,
  SCORECARD_DOC,
  SCORECARD_METRICS,
  writePilotRoiBaseline,
  writePilotRoiNotes,
  type PilotRoiMetricId,
} from "./pilot-roi-scorecard.js";

export type PilotRoiPanelProps = {
  /** Admin: scope to one hotel. Executive: omit to show hotel picker. */
  readonly hotelId?: string;
  /** Hide hotel filter when parent already scoped (admin facilities). */
  readonly compact?: boolean;
};

export function PilotRoiPanel({ hotelId: hotelIdProp, compact }: PilotRoiPanelProps) {
  const [hotels, setHotels] = useState<readonly HotelDto[]>([]);
  const [hotelId, setHotelId] = useState<string>(hotelIdProp ?? "");
  const [windowDays, setWindowDays] = useState(30);
  const [metrics, setMetrics] = useState<PilotRoiMetricsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [baselineVersion, setBaselineVersion] = useState(0);

  const effectiveHotelId = hotelIdProp ?? hotelId;

  useEffect(() => {
    if (hotelIdProp) {
      setHotelId(hotelIdProp);
      return;
    }
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
  }, [hotelIdProp]);

  useEffect(() => {
    if (!effectiveHotelId) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    void fetchPilotRoiMetrics({ hotelId: effectiveHotelId, windowDays })
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
  }, [effectiveHotelId, windowDays]);

  const handleBaselineChange = useCallback(
    (metricId: PilotRoiMetricId, value: string) => {
      if (!effectiveHotelId) return;
      writePilotRoiBaseline(effectiveHotelId, metricId, value);
      setBaselineVersion((v) => v + 1);
    },
    [effectiveHotelId],
  );

  const handleNotesChange = useCallback(
    (metricId: PilotRoiMetricId, value: string) => {
      if (!effectiveHotelId) return;
      writePilotRoiNotes(effectiveHotelId, metricId, value);
      setBaselineVersion((v) => v + 1);
    },
    [effectiveHotelId],
  );

  const rows = useMemo(() => {
    if (!metrics || !effectiveHotelId) {
      return [];
    }
    void baselineVersion;
    return SCORECARD_METRICS.map((def) => {
      const current = metricCurrentValue(metrics, def.id);
      const baselineRaw = readPilotRoiBaseline(effectiveHotelId, def.id);
      const userNotes = readPilotRoiNotes(effectiveHotelId, def.id);
      const delta = computeMetricDelta({
        current: current.numeric,
        baselineRaw,
        direction: def.direction,
        fractionDigits:
          def.id === "revenue-suggestion-approval" ||
          def.id === "morning-briefing" ||
          def.id === "upsell-revenue"
            ? 0
            : 1,
      });
      return {
        def,
        current,
        baselineRaw,
        userNotes,
        delta,
      };
    });
  }, [metrics, effectiveHotelId, baselineVersion]);

  const scopeLabel =
    metrics?.hotelName ??
    (effectiveHotelId
      ? hotels.find((h) => h.id === effectiveHotelId)?.name
      : null) ??
    "רשת";

  const showHotelPicker = !compact && !hotelIdProp && hotels.length > 1;

  return (
    <section className="pilot-roi" aria-labelledby="pilot-roi-heading">
      <header className="pilot-roi__header">
        <div>
          <h1 id="pilot-roi-heading">מדדי פיילוט / ROI</h1>
          <p className="pilot-roi__lead">
            מדדים תפעוליים חיים — baseline ויעד לפי{" "}
            <a href={SCORECARD_DOC} rel="noopener noreferrer">
              גיליון הפיילוט
            </a>
            . ערכי baseline נשמרים מקומית בדפדפן (להזנה בפיילוט) — לא נמדדים
            אוטומטית.
          </p>
        </div>
        <div className="pilot-roi__filters">
          {showHotelPicker ? (
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
          ) : null}
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

          <p className="pilot-roi__illustrative" role="note">
            עמודת baseline — להזנה בפיילוט (שבוע 0). Δ מחושב רק כש-baseline
            וערך נוכחי מספריים; השוואה ליעד היא ידנית.
          </p>

          <div className="pilot-roi__table-wrap">
            <table className="pilot-roi__table">
              <caption className="sr">
                מדדי פיילוט ROI — נוכחי, baseline, יעד והערות
              </caption>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">מדד</th>
                  <th scope="col">נוכחי</th>
                  <th scope="col">baseline (שבוע 0)</th>
                  <th scope="col">יעד</th>
                  <th scope="col">Δ</th>
                  <th scope="col">הערות</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ def, current, baselineRaw, userNotes, delta }) => (
                  <tr key={def.id}>
                    <td data-label="#">{def.row}</td>
                    <td data-label="מדד">{def.labelHe}</td>
                    <td data-label="נוכחי">
                      <span className="pilot-roi__current">{current.display}</span>
                      {current.unit ? (
                        <span className="pilot-roi__unit"> {current.unit}</span>
                      ) : null}
                    </td>
                    <td data-label="baseline (שבוע 0)">
                      <input
                        type="text"
                        className="pilot-roi__baseline-input"
                        value={baselineRaw}
                        placeholder={def.baselinePlaceholder}
                        aria-label={`baseline ${def.labelHe}`}
                        onChange={(event) =>
                          handleBaselineChange(def.id, event.target.value)
                        }
                      />
                    </td>
                    <td data-label="יעד">{def.targetHe}</td>
                    <td data-label="Δ">
                      {delta ? (
                        <span
                          className={
                            delta.improved
                              ? "pilot-roi__delta pilot-roi__delta--good"
                              : delta.improved === false && delta.absolute !== 0
                                ? "pilot-roi__delta pilot-roi__delta--warn"
                                : "pilot-roi__delta"
                          }
                        >
                          {delta.displayAbsolute}
                          {delta.displayPercent ? (
                            <span className="pilot-roi__delta-pct">
                              {" "}
                              ({delta.displayPercent})
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="pilot-roi__notes-cell" data-label="הערות">
                      <p className="pilot-roi__static-note">{def.staticNotesHe}</p>
                      <input
                        type="text"
                        className="pilot-roi__notes-input"
                        value={userNotes}
                        placeholder="הערות פיילוט (מקומי)"
                        aria-label={`הערות ${def.labelHe}`}
                        onChange={(event) =>
                          handleNotesChange(def.id, event.target.value)
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {metrics.notesHe.length > 0 ? (
            <aside className="pilot-roi__api-notes" aria-labelledby="pilot-roi-api-notes">
              <h2 id="pilot-roi-api-notes">הערות API / פרוקסי</h2>
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
        .pilot-roi { padding: clamp(1rem, 3vw, 2rem); max-width: 1100px; margin: 0 auto; }
        .pilot-roi__header { display: flex; flex-wrap: wrap; gap: var(--space-4); justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-4); }
        .pilot-roi__lead { color: var(--color-ink-muted); max-width: 42rem; line-height: 1.5; margin: 0; }
        .pilot-roi__lead a { color: var(--color-sea-deep); font-weight: 600; }
        .pilot-roi__filters { display: flex; flex-wrap: wrap; gap: var(--space-3); }
        .pilot-roi__filters label { display: grid; gap: .35rem; font-size: var(--text-small); font-weight: 600; }
        .pilot-roi__meta { font-size: var(--text-small); color: var(--color-ink-faint); margin-bottom: var(--space-2); }
        .pilot-roi__illustrative { font-size: var(--text-small); color: var(--color-ink-soft); background: var(--color-surface-muted); padding: .65rem .85rem; border-radius: var(--radius-sm); margin-bottom: var(--space-3); line-height: 1.45; }
        .pilot-roi__table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; border: 1px solid var(--color-line); border-radius: var(--radius-md); }
        .pilot-roi__table { width: 100%; border-collapse: collapse; min-width: 52rem; }
        .pilot-roi__table th, .pilot-roi__table td { padding: .65rem .75rem; text-align: start; border-bottom: 1px solid var(--color-line); vertical-align: top; }
        .pilot-roi__table th { background: var(--color-surface-muted); font-size: var(--text-small); white-space: nowrap; }
        .pilot-roi__table tr:last-child td { border-bottom: none; }
        .pilot-roi__current { font-weight: 600; }
        .pilot-roi__unit { font-size: var(--text-small); color: var(--color-ink-faint); }
        .pilot-roi__baseline-input, .pilot-roi__notes-input { width: 100%; min-width: 6rem; font: inherit; font-size: var(--text-small); border: 1px dashed var(--color-line-strong); border-radius: var(--radius-sm); padding: .4rem .55rem; background: #fff; min-height: var(--touch-min, 2.75rem); }
        .pilot-roi__baseline-input::placeholder { color: var(--color-ink-faint); font-style: italic; }
        .pilot-roi__notes-cell { min-width: 12rem; }
        .pilot-roi__static-note { margin: 0 0 .35rem; font-size: var(--text-small); color: var(--color-ink-soft); line-height: 1.35; }
        .pilot-roi__delta { font-weight: 600; font-size: var(--text-small); }
        .pilot-roi__delta--good { color: var(--color-sea-deep); }
        .pilot-roi__delta--warn { color: var(--color-danger); }
        .pilot-roi__delta-pct { font-weight: 500; color: var(--color-ink-faint); }
        .pilot-roi__api-notes { margin-top: var(--space-4); padding: var(--space-3); background: var(--color-surface-muted); border-radius: var(--radius-md); }
        .pilot-roi__api-notes h2 { font-size: 1rem; margin-bottom: var(--space-2); }
        .pilot-roi__api-notes ul { margin: 0; padding-inline-start: 1.25rem; display: grid; gap: .5rem; }
        .pilot-roi__error { color: var(--color-danger); }
        .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
        @media (max-width: 768px) {
          .pilot-roi__table { min-width: 0; }
          .pilot-roi__table thead { display: none; }
          .pilot-roi__table, .pilot-roi__table tbody, .pilot-roi__table tr, .pilot-roi__table td {
            display: block;
            width: 100%;
          }
          .pilot-roi__table tr {
            padding: .85rem .9rem;
            border-bottom: 1px solid var(--color-line);
          }
          .pilot-roi__table tr:last-child { border-bottom: none; }
          .pilot-roi__table td {
            border: 0;
            padding: .35rem 0;
          }
          .pilot-roi__table td::before {
            content: attr(data-label);
            display: block;
            font-size: var(--text-micro);
            font-weight: 700;
            letter-spacing: .04em;
            text-transform: uppercase;
            color: var(--color-ink-faint);
            margin-bottom: .2rem;
          }
          .pilot-roi__notes-cell { min-width: 0; }
        }
        @media (max-width: 640px) {
          .pilot-roi__header { flex-direction: column; }
          .pilot-roi__filters { width: 100%; }
          .pilot-roi__filters select { width: 100%; min-height: 2.75rem; }
        }
      `}</style>
    </section>
  );
}
