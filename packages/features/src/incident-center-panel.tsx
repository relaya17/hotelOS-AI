import { useCallback, useEffect, useMemo, useState } from "react";
import {
  APP_URLS,
  fetchIncidentCenter,
  listHotels,
  type HotelDto,
  type IncidentDto,
  type IncidentSeverity,
} from "@hotelos/web-client";
import { useIntervalRefresh } from "./use-interval-refresh.js";

export type IncidentCenterPanelProps = {
  /** When set, scope to one hotel (admin). Omit for chain view (executive). */
  readonly hotelId?: string;
  /** Hide hotel filter when admin is already scoped to one hotel. */
  readonly compact?: boolean;
};

const SEVERITY_OPTIONS: readonly {
  readonly value: IncidentSeverity | "all";
  readonly labelHe: string;
}[] = [
  { value: "all", labelHe: "הכל" },
  { value: "urgent", labelHe: "דחוף" },
  { value: "high", labelHe: "גבוה" },
  { value: "medium", labelHe: "בינוני" },
  { value: "low", labelHe: "נמוך" },
];

const DEPARTMENT_LABEL: Record<IncidentDto["department"], string> = {
  security: "אבטחה",
  it: "IT",
  maintenance: "תחזוקה",
};

const SEVERITY_LABEL: Record<IncidentSeverity, string> = {
  urgent: "דחוף",
  high: "גבוה",
  medium: "בינוני",
  low: "נמוך",
};

const STATUS_LABEL: Record<string, string> = {
  open: "פתוח",
  in_progress: "בטיפול",
  blocked: "חסום",
  quote_requested: "ממתין להצעה",
  approved: "אושר",
  done: "הושלם",
  cancelled: "בוטל",
};

const SOURCE_LABEL: Record<string, string> = {
  security_event: "אירוע אבטחה",
  error_event: "שגיאת מערכת",
  anomaly_alert: "חריגה תפעולית",
  maintenance_request: "קריאת תחזוקה",
  department_task: "משימת מחלקה",
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function incidentDeepLink(incident: IncidentDto): string | null {
  if (!incident.taskId) {
    return null;
  }
  const panel =
    incident.source === "maintenance_request" ? "maintenance" : "departments";
  return `${APP_URLS.admin}?hotelId=${encodeURIComponent(incident.hotelId)}&panel=${panel}`;
}

export function IncidentCenterPanel({
  hotelId: fixedHotelId,
  compact = false,
}: IncidentCenterPanelProps) {
  const [hotels, setHotels] = useState<readonly HotelDto[]>([]);
  const [selectedHotelId, setSelectedHotelId] = useState<string>(
    fixedHotelId ?? "all",
  );
  const [severity, setSeverity] = useState<IncidentSeverity | "all">("all");
  const [incidents, setIncidents] = useState<readonly IncidentDto[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [statusMessage, setStatusMessage] = useState("טוען אירועים…");

  useEffect(() => {
    if (fixedHotelId) {
      setSelectedHotelId(fixedHotelId);
      return;
    }
    let cancelled = false;
    async function loadHotels() {
      try {
        const rows = await listHotels();
        if (!cancelled) {
          setHotels(rows);
        }
      } catch {
        /* hotel list is optional for chain filter */
      }
    }
    void loadHotels();
    return () => {
      cancelled = true;
    };
  }, [fixedHotelId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    setStatusMessage("טוען אירועים…");
    try {
      const scopedHotelId =
        selectedHotelId === "all" ? undefined : selectedHotelId;
      const data = await fetchIncidentCenter(scopedHotelId);
      setIncidents(data.incidents);
      setGeneratedAt(data.generatedAt);
      setStatusMessage(
        data.incidents.length === 0
          ? "אין אירועים פתוחים כרגע."
          : `${data.incidents.length} אירועים פתוחים.`,
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "שגיאה בטעינה",
      );
      setStatusMessage("שגיאה בטעינת מרכז האירועים.");
    } finally {
      setLoading(false);
    }
  }, [selectedHotelId]);

  useEffect(() => {
    void load();
  }, [load]);

  useIntervalRefresh(load, 30_000);

  const filtered = useMemo(() => {
    if (severity === "all") {
      return incidents;
    }
    return incidents.filter((incident) => incident.severity === severity);
  }, [incidents, severity]);

  const counts = useMemo(() => {
    const base: Record<IncidentSeverity | "all", number> = {
      all: incidents.length,
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    for (const incident of incidents) {
      base[incident.severity] += 1;
    }
    return base;
  }, [incidents]);

  return (
    <div className="incident-center">
      <header className="incident-center__header">
        <div>
          <p className="hotelos-eyebrow">Incident Center · מרכז אירועים</p>
          <h1>מרכז אירועים</h1>
          <p className="sub">
            אבטחה, בטיחות ו-IT — תמונה מאוחדת ממשימות מחלקה, Sentry, VMS וחריגות
            תפעוליות.
          </p>
        </div>
        {!compact && hotels.length > 1 ? (
          <label className="incident-center__filter">
            <span id="incident-hotel-label">מלון</span>
            <select
              className="hotelos-select"
              aria-labelledby="incident-hotel-label"
              value={selectedHotelId}
              onChange={(event) =>
                setSelectedHotelId(
                  event.target.value === "all" ? "all" : event.target.value,
                )
              }
            >
              <option value="all">כל הרשת</option>
              {hotels.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>
                  {hotel.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </header>

      <div
        className="incident-center__status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {loading ? statusMessage : statusMessage}
        {generatedAt && !loading ? (
          <span className="incident-center__updated">
            {" "}
            · עודכן {formatWhen(generatedAt)}
          </span>
        ) : null}
      </div>

      {error !== undefined ? (
        <p className="state state--error" role="alert">
          {error}
        </p>
      ) : null}

      <section aria-labelledby="incident-severity-heading">
        <h2 id="incident-severity-heading" className="sr">
          סינון לפי חומרה
        </h2>
        <ul className="incident-center__chips" role="list">
          {SEVERITY_OPTIONS.map((option) => {
            const active = severity === option.value;
            const count = counts[option.value];
            return (
              <li key={option.value}>
                <button
                  type="button"
                  className={
                    active
                      ? "incident-chip incident-chip--on"
                      : "incident-chip"
                  }
                  aria-pressed={active}
                  onClick={() => setSeverity(option.value)}
                >
                  {option.labelHe}
                  <span className="incident-chip__count" aria-hidden="true">
                    {count}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="incident-list-heading">
        <h2 id="incident-list-heading">אירועים פתוחים</h2>
        {loading ? <p className="state">טוען…</p> : null}
        {!loading && filtered.length === 0 ? (
          <p className="hint">אין אירועים התואמים לסינון.</p>
        ) : null}
        {!loading && filtered.length > 0 ? (
          <ol className="incident-list">
            {filtered.map((incident) => {
              const link = incidentDeepLink(incident);
              return (
                <li key={incident.id} className="incident-card">
                  <div className="incident-card__meta">
                    <span
                      className={`incident-severity incident-severity--${incident.severity}`}
                    >
                      {SEVERITY_LABEL[incident.severity]}
                    </span>
                    <span className="incident-card__dept">
                      {DEPARTMENT_LABEL[incident.department]}
                    </span>
                    {!compact && selectedHotelId === "all" ? (
                      <span className="incident-card__hotel">
                        {incident.hotelName}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="incident-card__title">{incident.title}</h3>
                  <dl className="incident-card__details">
                    <div>
                      <dt>מקור</dt>
                      <dd>{SOURCE_LABEL[incident.source] ?? incident.source}</dd>
                    </div>
                    <div>
                      <dt>סטטוס</dt>
                      <dd>{STATUS_LABEL[incident.status] ?? incident.status}</dd>
                    </div>
                    <div>
                      <dt>נוצר</dt>
                      <dd>
                        <time dateTime={incident.createdAt}>
                          {formatWhen(incident.createdAt)}
                        </time>
                      </dd>
                    </div>
                  </dl>
                  {link ? (
                    <a className="incident-card__link" href={link}>
                      פתח משימה בתפעול המלון
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : null}
      </section>

      <style>{`
        .incident-center { display:grid; gap:var(--space-4); align-content:start; animation:hotelos-enter var(--motion-med) var(--ease-out) both; }
        .incident-center__header { display:flex; justify-content:space-between; gap:var(--space-4); align-items:flex-start; flex-wrap:wrap; }
        .incident-center__header .hotelos-eyebrow { margin-bottom:var(--space-2); }
        h1 { font-size:var(--text-display); margin:0; }
        .sub { margin:var(--space-2) 0 0; color:var(--color-ink-soft); max-width:62ch; font-weight:500; }
        .incident-center__filter { display:grid; gap:var(--space-2); min-width:min(100%,14rem); }
        .incident-center__filter span { font-size:var(--text-small); font-weight:600; color:var(--color-ink-soft); }
        .incident-center__status { margin:0; color:var(--color-ink-soft); font-weight:500; font-size:var(--text-small); }
        .incident-center__updated { color:var(--color-ink-faint); }
        .incident-center__chips { list-style:none; margin:0; padding:0; display:flex; flex-wrap:wrap; gap:var(--space-2); }
        .incident-chip { display:inline-flex; align-items:center; gap:.45rem; border:1px solid var(--color-line); background:var(--color-paper-elevated); border-radius:999px; padding:.45rem .85rem; font:inherit; font-weight:600; cursor:pointer; min-height:var(--touch-min, 2.75rem); }
        .incident-chip--on { border-color:var(--color-sea-deep); background:var(--color-sea-soft); color:var(--color-sea-deep); }
        .incident-chip__count { font-size:var(--text-micro); opacity:.85; }
        #incident-list-heading { margin:0 0 var(--space-3); font-size:var(--text-title); }
        .incident-list { list-style:none; margin:0; padding:0; display:grid; gap:var(--space-3); }
        .incident-card { display:grid; gap:var(--space-2); padding:var(--space-4); border:1px solid var(--color-line); border-radius:var(--radius-md); background:var(--color-paper-elevated); box-shadow:var(--shadow-soft); }
        .incident-card__meta { display:flex; flex-wrap:wrap; gap:var(--space-2); align-items:center; }
        .incident-severity { font-size:var(--text-micro); font-weight:700; letter-spacing:.03em; text-transform:uppercase; border-radius:999px; padding:.2rem .55rem; }
        .incident-severity--urgent { background:#fde8e8; color:var(--color-danger); }
        .incident-severity--high { background:#fff3e0; color:#b45309; }
        .incident-severity--medium { background:#eef6ff; color:var(--color-sea-deep); }
        .incident-severity--low { background:#f3f4f6; color:var(--color-ink-soft); }
        .incident-card__dept, .incident-card__hotel { font-size:var(--text-small); color:var(--color-ink-soft); font-weight:600; }
        .incident-card__title { margin:0; font-size:1.05rem; }
        .incident-card__details { margin:0; display:grid; grid-template-columns:repeat(auto-fit,minmax(7rem,1fr)); gap:var(--space-2); }
        .incident-card__details dt { font-size:var(--text-micro); color:var(--color-ink-faint); font-weight:600; }
        .incident-card__details dd { margin:0; font-weight:600; }
        .incident-card__link { font-weight:700; color:var(--color-sea-deep); width:fit-content; }
        .hint, .state { margin:0; color:var(--color-ink-soft); font-weight:500; }
        .state--error { color:var(--color-danger); }
        .sr { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
        @media (max-width:640px){
          h1{ font-size:clamp(1.35rem,6vw,2rem); }
          .incident-card__details{ grid-template-columns:1fr 1fr; }
        }
      `}</style>
    </div>
  );
}
