import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@hotelos/ui";
import {
  PredictiveMaintenancePanel,
  useIntervalRefresh,
} from "@hotelos/features";
import {
  APP_URLS,
  fetchDailyBriefing,
  fetchEnergySuggestions,
  fetchHotelTwin,
  fetchIncidentCenter,
  fetchOpsDashboard,
  fetchOpsForecast,
  fetchOpsKnowledgeGraph,
  fetchReputationReviews,
  generateEnergySuggestions,
  type DailyBriefingHotelDto,
  type EnergySuggestionDto,
  type HotelTwinOverlaysDto,
  type IncidentDto,
  type IncidentSeverity,
  type OpsDashboardHotelDto,
  type OpsForecastDto,
  type OpsKnowledgeGraphDto,
  type ReputationReviewDto,
} from "@hotelos/web-client";

const REFRESH_MS = 30_000;

const INCIDENT_SEVERITY_RANK: Record<IncidentSeverity, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const INCIDENT_SEVERITY_LABEL: Record<IncidentSeverity, string> = {
  urgent: "דחוף",
  high: "גבוה",
  medium: "בינוני",
  low: "נמוך",
};

const KG_EDGE_LABELS_HE: Record<string, string> = {
  has_room: "מכיל חדר",
  has_booking: "הזמנה",
  assigned_to: "משויך לחדר",
  booked_by: "הוזמן על ידי",
  stays_at: "שוהה במלון",
  open_incident: "אירוע פתוח",
  linked_task: "משימה קשורה",
  equipment_at: "ציוד במלון",
  predicts_on: "חיזוי על ציוד",
  predicts_at: "חיזוי במלון",
};

function edgeTypeLabelHe(type: string): string {
  return KG_EDGE_LABELS_HE[type] ?? type;
}

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

  const [energySuggestions, setEnergySuggestions] = useState<
    readonly EnergySuggestionDto[]
  >([]);
  const [energyLoading, setEnergyLoading] = useState(false);
  const [energyError, setEnergyError] = useState<string | undefined>();

  const [knowledgeGraph, setKnowledgeGraph] = useState<OpsKnowledgeGraphDto | null>(
    null,
  );
  const [kgLoading, setKgLoading] = useState(false);
  const [kgError, setKgError] = useState<string | undefined>();

  const [incidents, setIncidents] = useState<readonly IncidentDto[]>([]);
  const [incidentsGeneratedAt, setIncidentsGeneratedAt] = useState<
    string | undefined
  >();
  const [incidentsLoading, setIncidentsLoading] = useState(true);
  const [incidentsError, setIncidentsError] = useState<string | undefined>();

  const [twinOverlays, setTwinOverlays] = useState<HotelTwinOverlaysDto | null>(
    null,
  );
  const [twinLoading, setTwinLoading] = useState(false);
  const [twinError, setTwinError] = useState<string | undefined>();

  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | undefined>();

  const firstHotelId = hotels[0]?.hotelId;
  const firstHotelName = hotels[0]?.hotelName;

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

  const loadBriefing = useCallback(async () => {
    setBriefingLoading(true);
    setBriefingError(undefined);
    try {
      const data = await fetchDailyBriefing();
      setBriefingHotels(data.hotels);
      setChainSummaryHe(data.chainSummaryHe ?? undefined);
    } catch (loadError) {
      setBriefingError(
        loadError instanceof Error ? loadError.message : "שגיאה בטעינת התדריך",
      );
    } finally {
      setBriefingLoading(false);
    }
  }, []);

  const loadIncidents = useCallback(async () => {
    setIncidentsLoading(true);
    setIncidentsError(undefined);
    try {
      const data = await fetchIncidentCenter(
        firstHotelId !== undefined ? firstHotelId : undefined,
      );
      setIncidents(data.incidents);
      setIncidentsGeneratedAt(data.generatedAt);
    } catch (loadError) {
      setIncidentsError(
        loadError instanceof Error ? loadError.message : "שגיאה בטעינת אירועים",
      );
    } finally {
      setIncidentsLoading(false);
    }
  }, [firstHotelId]);

  const loadTwin = useCallback(async () => {
    if (firstHotelId === undefined) {
      setTwinOverlays(null);
      return;
    }
    setTwinLoading(true);
    setTwinError(undefined);
    try {
      const twin = await fetchHotelTwin(firstHotelId);
      setTwinOverlays(twin.overlays ?? null);
    } catch (loadError) {
      setTwinError(
        loadError instanceof Error ? loadError.message : "שגיאה בטעינת Twin",
      );
    } finally {
      setTwinLoading(false);
    }
  }, [firstHotelId]);

  const loadForecastLive = useCallback(async () => {
    if (firstHotelId === undefined) {
      setForecast(null);
      return;
    }
    setForecastLoading(true);
    setForecastError(undefined);
    try {
      const data = await fetchOpsForecast(firstHotelId);
      setForecast(data);
    } catch (loadError) {
      setForecastError(
        loadError instanceof Error ? loadError.message : "שגיאה בטעינת תחזית",
      );
    } finally {
      setForecastLoading(false);
    }
  }, [firstHotelId]);

  const refreshLiveData = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadBriefing(),
        loadIncidents(),
        loadTwin(),
        loadForecastLive(),
      ]);
      setLastRefreshedAt(new Date().toISOString());
    } finally {
      setRefreshing(false);
    }
  }, [loadBriefing, loadIncidents, loadTwin, loadForecastLive]);

  useEffect(() => {
    void refreshLiveData();
  }, [refreshLiveData]);

  const { prefersReducedMotion, refreshNow } = useIntervalRefresh(
    refreshLiveData,
    REFRESH_MS,
  );

  useEffect(() => {
    const firstHotelId = hotels[0]?.hotelId;
    if (firstHotelId === undefined) {
      setEnergySuggestions([]);
      return;
    }
    const hotelId: string = firstHotelId;
    let cancelled = false;
    async function loadEnergy() {
      setEnergyLoading(true);
      setEnergyError(undefined);
      try {
        const rows = await fetchEnergySuggestions(hotelId);
        if (!cancelled) setEnergySuggestions(rows);
      } catch (loadError) {
        if (!cancelled) {
          setEnergyError(
            loadError instanceof Error ? loadError.message : "שגיאה בטעינת אנרגיה",
          );
        }
      } finally {
        if (!cancelled) setEnergyLoading(false);
      }
    }
    void loadEnergy();
    return () => {
      cancelled = true;
    };
  }, [hotels]);

  useEffect(() => {
    const firstHotelId = hotels[0]?.hotelId;
    if (firstHotelId === undefined) {
      setKnowledgeGraph(null);
      return;
    }
    const hotelId: string = firstHotelId;
    let cancelled = false;
    async function loadKnowledgeGraph() {
      setKgLoading(true);
      setKgError(undefined);
      try {
        const graph = await fetchOpsKnowledgeGraph(hotelId);
        if (!cancelled) setKnowledgeGraph(graph);
      } catch (loadError) {
        if (!cancelled) {
          setKgError(
            loadError instanceof Error
              ? loadError.message
              : "שגיאה בטעינת גרף הידע",
          );
        }
      } finally {
        if (!cancelled) setKgLoading(false);
      }
    }
    void loadKnowledgeGraph();
    return () => {
      cancelled = true;
    };
  }, [hotels]);

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

  const kgNodeLabels = new Map(
    (knowledgeGraph?.nodes ?? []).map((node) => [node.id, node.label]),
  );
  const kgEdgeCounts = (knowledgeGraph?.edges ?? []).reduce<
    Record<string, number>
  >((acc, edge) => {
    acc[edge.type] = (acc[edge.type] ?? 0) + 1;
    return acc;
  }, {});
  const kgEdgeCountEntries = Object.entries(kgEdgeCounts).sort(
    (a, b) => b[1] - a[1],
  );
  const kgSampleEdges = (knowledgeGraph?.edges ?? []).slice(0, 8);

  const incidentCounts = useMemo(() => {
    const counts = { urgent: 0, high: 0 };
    for (const incident of incidents) {
      if (incident.severity === "urgent") counts.urgent += 1;
      if (incident.severity === "high") counts.high += 1;
    }
    return counts;
  }, [incidents]);

  const topIncidents = useMemo(() => {
    return [...incidents]
      .sort((a, b) => {
        const rank =
          INCIDENT_SEVERITY_RANK[a.severity] - INCIDENT_SEVERITY_RANK[b.severity];
        if (rank !== 0) return rank;
        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      })
      .slice(0, 5);
  }, [incidents]);

  const liveRefreshing = refreshing || briefingLoading || incidentsLoading;

  async function onGenerateEnergy() {
    const hotelId = hotels[0]?.hotelId;
    if (!hotelId) return;
    setEnergyLoading(true);
    setEnergyError(undefined);
    try {
      const result = await generateEnergySuggestions(hotelId);
      setEnergySuggestions(result.suggestions);
    } catch (genError) {
      setEnergyError(
        genError instanceof Error ? genError.message : "יצירת הצעות אנרגיה נכשלה",
      );
    } finally {
      setEnergyLoading(false);
    }
  }

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
        <div className="ops-dash__actions">
          {lastRefreshedAt ? (
            <p className="ops-dash__updated" aria-live="polite">
              עודכן{" "}
              {new Date(lastRefreshedAt).toLocaleTimeString("he-IL", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </p>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            disabled={liveRefreshing}
            onClick={() => {
              refreshNow();
            }}
          >
            {liveRefreshing ? "מרענן…" : "רענן"}
          </Button>
          {!prefersReducedMotion && liveRefreshing ? (
            <span className="ops-dash__pulse" aria-hidden="true" />
          ) : null}
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

      <section className="card incidents-card" aria-labelledby="ops-incidents-heading">
        <h2 id="ops-incidents-heading">מרכז אירועים — סיכום</h2>
        <p className="hint">
          {firstHotelName ?? "כל הרשת"} — דחוף וגבוה, חמישה אירועים מובילים.
        </p>
        {incidentsLoading ? <p className="state">טוען אירועים…</p> : null}
        {incidentsError !== undefined ? (
          <p className="state state--error" role="alert">
            {incidentsError}
          </p>
        ) : null}
        {!incidentsLoading && !incidentsError ? (
          <>
            <div className="incident-kpi-row" aria-label="סיכום חומרה">
              <article className="incident-kpi incident-kpi--urgent">
                <p>דחוף</p>
                <strong>{incidentCounts.urgent}</strong>
              </article>
              <article className="incident-kpi incident-kpi--high">
                <p>גבוה</p>
                <strong>{incidentCounts.high}</strong>
              </article>
            </div>
            {topIncidents.length === 0 ? (
              <p className="hint">אין אירועים פתוחים כרגע.</p>
            ) : (
              <ol className="incident-summary-list">
                {topIncidents.map((incident) => (
                  <li key={incident.id}>
                    <span
                      className={`incident-severity incident-severity--${incident.severity}`}
                    >
                      {INCIDENT_SEVERITY_LABEL[incident.severity]}
                    </span>
                    <span>{incident.title}</span>
                    {firstHotelId === undefined ? (
                      <span className="incident-summary-hotel">
                        {incident.hotelName}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
            {incidentsGeneratedAt ? (
              <p className="ops-meta">
                נתוני אירועים · עודכן {incidentsGeneratedAt.slice(0, 19)}
              </p>
            ) : null}
            <a className="open-ops" href="#incidents">
              פתח מרכז אירועים
            </a>
          </>
        ) : null}
      </section>

      {firstHotelId !== undefined ? (
        <section className="card twin-card" aria-labelledby="ops-twin-heading">
          <h2 id="ops-twin-heading">Digital Twin — שכבות</h2>
          <p className="hint">
            {firstHotelName} — אירועים, חיזוי תחזוקה והצעות אנרגיה על גבי התאום.
          </p>
          {twinLoading ? <p className="state">טוען Twin…</p> : null}
          {twinError !== undefined ? (
            <p className="state state--error" role="alert">
              {twinError}
            </p>
          ) : null}
          {!twinLoading && !twinError ? (
            <>
              <div className="twin-kpi-row" aria-label="סיכום שכבות Twin">
                <article className="twin-kpi">
                  <p>אירועים פתוחים</p>
                  <strong>{twinOverlays?.openIncidents.count ?? 0}</strong>
                </article>
                <article className="twin-kpi">
                  <p>תחזוקה חיזויית</p>
                  <strong>{twinOverlays?.predictiveAlerts.count ?? 0}</strong>
                </article>
                <article className="twin-kpi">
                  <p>הצעות אנרגיה</p>
                  <strong>{twinOverlays?.energyHints.count ?? 0}</strong>
                </article>
              </div>
              {twinOverlays ? (
                <p className="ops-meta">
                  שכבות Twin · עודכן {twinOverlays.generatedAt.slice(0, 19)}
                </p>
              ) : null}
              <a
                className="open-ops open-ops--twin"
                href={`${APP_URLS.admin}?hotelId=${firstHotelId}&panel=twin`}
              >
                פתח Digital Twin בתפעול
              </a>
            </>
          ) : null}
        </section>
      ) : null}

      <section className="card kg-card" aria-labelledby="ops-kg-heading">
        <h2 id="ops-kg-heading">גרף ידע תפעולי</h2>
        <p className="hint">
          {hotels[0]?.hotelName ?? "מלון ראשון ברשת"} — קשרים מפורשים מנתוני
          המערכת (חדרים, הזמנות, אורחים, אירועים, ציוד).
        </p>
        {kgLoading ? <p className="state">טוען גרף…</p> : null}
        {kgError !== undefined ? (
          <p className="state state--error" role="alert">
            {kgError}
          </p>
        ) : null}
        {!kgLoading && knowledgeGraph ? (
          <>
            <p className="kg-meta">
              {knowledgeGraph.nodes.length} ישויות · {knowledgeGraph.edges.length}{" "}
              קשרים · עודכן {knowledgeGraph.generatedAt.slice(0, 19)}
            </p>
            {kgEdgeCountEntries.length > 0 ? (
              <ul className="kg-types">
                {kgEdgeCountEntries.map(([type, count]) => (
                  <li key={type}>
                    <span>{edgeTypeLabelHe(type)}</span>
                    <strong>{count}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="hint">אין קשרים עדיין.</p>
            )}
            {kgSampleEdges.length > 0 ? (
              <>
                <h3 className="kg-sample-title">דוגמאות קשרים</h3>
                <ul className="kg-samples">
                  {kgSampleEdges.map((edge) => (
                    <li key={`${edge.from}-${edge.type}-${edge.to}`}>
                      <span className="kg-edge-type">{edgeTypeLabelHe(edge.type)}</span>
                      {" · "}
                      {kgNodeLabels.get(edge.from) ?? edge.from}
                      {" → "}
                      {kgNodeLabels.get(edge.to) ?? edge.to}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </>
        ) : null}
        {!kgLoading && !kgError && hotels.length === 0 ? (
          <p className="hint">טעינת מלונות נדרשת לפני גרף הידע.</p>
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

      <section className="card energy-card" aria-labelledby="ops-energy-heading">
        <h2 id="ops-energy-heading">אנרגיה</h2>
        <p className="hint">
          {hotels[0]?.hotelName ?? "מלון ראשון ברשת"} — HVAC/חשמל לפי תפוסה (HITL).
        </p>
        <Button
          type="button"
          onClick={() => void onGenerateEnergy()}
          disabled={energyLoading || hotels.length === 0}
        >
          {energyLoading ? "מחשב…" : "צור הצעות אנרגיה"}
        </Button>
        {energyLoading ? <p className="state">טוען…</p> : null}
        {energyError !== undefined ? (
          <p className="state state--error" role="alert">
            {energyError}
          </p>
        ) : null}
        {!energyLoading && energySuggestions.length === 0 ? (
          <p className="hint">אין הצעות אנרגיה — לחצו ליצירה.</p>
        ) : null}
        {energySuggestions.length > 0 ? (
          <ul className="briefing-list">
            {energySuggestions.slice(0, 5).map((row) => (
              <li key={row.id}>
                <strong>{row.periodDate}</strong> — {row.suggestionHe}
                {row.estimatedSavingPct > 0
                  ? ` (חיסכון ~${row.estimatedSavingPct}%)`
                  : ""}
              </li>
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

      {hotels[0]?.hotelId !== undefined ? (
        <section className="card pm-card" aria-labelledby="pm-dash-heading">
          <PredictiveMaintenancePanel hotelId={hotels[0].hotelId} />
        </section>
      ) : null}

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
        .ops-dash__actions { display:flex; flex-wrap:wrap; align-items:center; gap:var(--space-2); justify-content:flex-end; }
        .ops-dash__updated { margin:0; font-size:var(--text-small); color:var(--color-ink-soft); font-weight:500; }
        .ops-dash__pulse { width:.65rem; height:.65rem; border-radius:50%; background:var(--color-sea-deep); animation:ops-pulse 1s ease-in-out infinite; }
        @keyframes ops-pulse { 0%,100%{ opacity:.35; transform:scale(.9); } 50%{ opacity:1; transform:scale(1); } }
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
        .incidents-card, .twin-card { border-color:var(--color-line-strong); }
        .incident-kpi-row, .twin-kpi-row { display:grid; gap:var(--space-3); margin:var(--space-3) 0; }
        .incident-kpi-row { grid-template-columns:repeat(2,minmax(0,1fr)); }
        .twin-kpi-row { grid-template-columns:repeat(3,minmax(0,1fr)); }
        .incident-kpi, .twin-kpi { padding:var(--space-3); border:1px solid var(--color-line); border-radius:var(--radius-sm); background:var(--color-paper); }
        .incident-kpi p, .twin-kpi p { margin:0; font-size:var(--text-small); color:var(--color-ink-soft); font-weight:500; }
        .incident-kpi strong, .twin-kpi strong { display:block; margin-top:var(--space-1); font-family:var(--font-display); font-size:1.5rem; }
        .incident-kpi--urgent strong { color:var(--color-danger); }
        .incident-kpi--high strong { color:#b45309; }
        .incident-summary-list { margin:0 0 var(--space-3); padding-inline-start:1.2rem; display:grid; gap:var(--space-2); }
        .incident-summary-list li { display:flex; flex-wrap:wrap; gap:var(--space-2); align-items:center; font-weight:500; }
        .incident-severity { font-size:var(--text-micro); font-weight:700; letter-spacing:.03em; text-transform:uppercase; border-radius:999px; padding:.2rem .55rem; }
        .incident-severity--urgent { background:#fde8e8; color:var(--color-danger); }
        .incident-severity--high { background:#fff3e0; color:#b45309; }
        .incident-severity--medium { background:#eef6ff; color:var(--color-sea-deep); }
        .incident-severity--low { background:#f3f4f6; color:var(--color-ink-soft); }
        .incident-summary-hotel { font-size:var(--text-small); color:var(--color-ink-soft); font-weight:600; }
        .ops-meta { margin:0 0 var(--space-2); font-size:var(--text-small); color:var(--color-ink-faint); font-weight:500; }
        .kg-card { border-color:var(--color-line-strong); }
        .kg-meta { margin:0 0 var(--space-3); font-size:var(--text-small); color:var(--color-ink-soft); font-weight:600; }
        .kg-types { list-style:none; margin:0 0 var(--space-3); padding:0; display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:var(--space-2); }
        .kg-types li { display:flex; justify-content:space-between; gap:var(--space-2); padding:var(--space-2) var(--space-3); border:1px solid var(--color-line); border-radius:var(--radius-sm); background:var(--color-paper); font-size:var(--text-small); }
        .kg-types strong { font-family:var(--font-display); }
        .kg-sample-title { margin:0 0 var(--space-2); font-size:var(--text-body); font-weight:700; }
        .kg-samples { margin:0; padding-inline-start:1.2rem; display:grid; gap:var(--space-2); font-size:var(--text-small); }
        .kg-edge-type { font-weight:700; color:var(--color-sea-deep); }
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
          .ops-dash__actions{ justify-content:flex-start; }
          .twin-kpi-row{ grid-template-columns:1fr; }
          h1{ font-size:clamp(1.35rem,6vw,2rem); word-break:break-word; }
          .kpi-row{ grid-template-columns:1fr 1fr; }
          .hotel-grid{ grid-template-columns:1fr; }
        }
      `}</style>
    </div>
  );
}
