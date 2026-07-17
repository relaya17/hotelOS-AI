import { useEffect, useMemo, useState } from "react";
import { Button } from "@hotelos/ui";
import { type LocaleCode } from "@hotelos/i18n";
import {
  APP_URLS,
  logout,
  fetchChainOverview,
  type ChainOverviewDto,
  type HotelOverviewDto,
  type StoredUser,
} from "@hotelos/web-client";

export type ChainDashboardProps = {
  readonly user: StoredUser;
  readonly onLogout: () => void;
  /** When true, top chrome is provided by ExecutiveShell. */
  readonly embedded?: boolean;
  readonly locale?: LocaleCode;
};

type AttentionReason =
  | { readonly kind: "maintenance"; readonly count: number }
  | { readonly kind: "dirty"; readonly count: number }
  | { readonly kind: "highOccupancy"; readonly pct: number };

type AttentionItem = {
  readonly hotelId: string;
  readonly hotelName: string;
  readonly reasons: readonly AttentionReason[];
  readonly activeBookings: number;
};

type PortfolioLabels = {
  readonly eyebrow: string;
  readonly titleFallback: string;
  readonly hotelsInChain: (count: number | string) => string;
  readonly kpiAria: string;
  readonly kpiHotels: string;
  readonly kpiOccupancy: string;
  readonly kpiDirty: string;
  readonly kpiBookings: string;
  readonly attentionTitle: string;
  readonly attentionNone: string;
  readonly attentionOpenOps: string;
  readonly reasonMaintenance: (count: number) => string;
  readonly reasonDirty: (count: number) => string;
  readonly reasonHighOccupancy: (pct: number) => string;
  readonly activeBookingsContext: (count: number) => string;
  readonly hotelsTitle: string;
  readonly hotelsHint: string;
  readonly openHotelOps: string;
  readonly logout: string;
  readonly loading: string;
  readonly loadError: string;
  readonly metricOccupancy: string;
  readonly metricVacant: string;
  readonly metricDirty: string;
  readonly metricMaintenance: string;
  readonly metricActiveBookings: string;
};

const LABELS: Record<"he" | "en", PortfolioLabels> = {
  he: {
    eyebrow: "Control Tower · רמת רשת",
    titleFallback: "לוח בקרה לרשת",
    hotelsInChain: (count) => `${count} מלונות ברשת`,
    kpiAria: "סיכום רשת",
    kpiHotels: "מלונות",
    kpiOccupancy: "תפוסה ברשת",
    kpiDirty: "ממתינים לניקיון",
    kpiBookings: "הזמנות פעילות",
    attentionTitle: "דורש תשומת לב",
    attentionNone: "אין נכסים שדורשים תשומת לב כרגע",
    attentionOpenOps: "פתח תפעול",
    reasonMaintenance: (count) =>
      count === 1 ? "חדר אחד בתחזוקה" : `${count} חדרים בתחזוקה`,
    reasonDirty: (count) =>
      count === 1 ? "חדר אחד ממתין לניקיון" : `${count} חדרים ממתינים לניקיון`,
    reasonHighOccupancy: (pct) => `תפוסה גבוהה (${pct}%)`,
    activeBookingsContext: (count) =>
      count === 1 ? "הזמנה פעילה אחת" : `${count} הזמנות פעילות`,
    hotelsTitle: "בתי מלון ברשת",
    hotelsHint:
      "מבט-על לכל הנכסים. לתפעול יומיומי (חדרים/הזמנות) עברו לאפליקציית Admin הנפרדת.",
    openHotelOps: "פתח תפעול מלון",
    logout: "התנתקות",
    loading: "טוען…",
    loadError: "שגיאה בטעינה",
    metricOccupancy: "תפוסה",
    metricVacant: "פנויים",
    metricDirty: "לניקיון",
    metricMaintenance: "תחזוקה",
    metricActiveBookings: "הזמנות פעילות",
  },
  en: {
    eyebrow: "Control Tower · Chain level",
    titleFallback: "Chain control tower",
    hotelsInChain: (count) => `${count} hotels in chain`,
    kpiAria: "Chain summary",
    kpiHotels: "Hotels",
    kpiOccupancy: "Chain occupancy",
    kpiDirty: "Awaiting housekeeping",
    kpiBookings: "Active bookings",
    attentionTitle: "Needs attention",
    attentionNone: "No properties need attention right now",
    attentionOpenOps: "Open ops",
    reasonMaintenance: (count) =>
      count === 1 ? "1 room in maintenance" : `${count} rooms in maintenance`,
    reasonDirty: (count) =>
      count === 1 ? "1 room awaiting housekeeping" : `${count} rooms awaiting housekeeping`,
    reasonHighOccupancy: (pct) => `High occupancy (${pct}%)`,
    activeBookingsContext: (count) =>
      count === 1 ? "1 active booking" : `${count} active bookings`,
    hotelsTitle: "Hotels in chain",
    hotelsHint:
      "Portfolio overview for every property. For daily ops (rooms/bookings), use the separate Admin app.",
    openHotelOps: "Open hotel ops",
    logout: "Sign out",
    loading: "Loading…",
    loadError: "Load error",
    metricOccupancy: "Occupancy",
    metricVacant: "Vacant",
    metricDirty: "Dirty",
    metricMaintenance: "Maintenance",
    metricActiveBookings: "Active bookings",
  },
};

function labelsFor(locale: LocaleCode | undefined): PortfolioLabels {
  return locale === "en" ? LABELS.en : LABELS.he;
}

function hotelOccupancyRatio(hotel: HotelOverviewDto): number {
  if (hotel.rooms.total === 0) return 0;
  return hotel.rooms.occupied / hotel.rooms.total;
}

function hotelOccupancyPct(hotel: HotelOverviewDto): number {
  return Math.round(hotelOccupancyRatio(hotel) * 100);
}

function attentionScore(item: AttentionItem): number {
  let score = 0;
  for (const reason of item.reasons) {
    if (reason.kind === "maintenance") score += 1000 + reason.count;
    if (reason.kind === "dirty") score += 100 + reason.count;
    if (reason.kind === "highOccupancy") score += reason.pct;
  }
  return score;
}

function buildAttentionItems(
  hotels: readonly HotelOverviewDto[],
): readonly AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const hotel of hotels) {
    const reasons: AttentionReason[] = [];

    if (hotel.rooms.maintenance > 0) {
      reasons.push({ kind: "maintenance", count: hotel.rooms.maintenance });
    }
    if (hotel.rooms.dirty > 0) {
      reasons.push({ kind: "dirty", count: hotel.rooms.dirty });
    }
    if (hotel.rooms.total > 0 && hotelOccupancyRatio(hotel) >= 0.9) {
      reasons.push({
        kind: "highOccupancy",
        pct: hotelOccupancyPct(hotel),
      });
    }

    if (reasons.length > 0) {
      items.push({
        hotelId: hotel.id,
        hotelName: hotel.name,
        reasons,
        activeBookings: hotel.bookings.active,
      });
    }
  }

  return items.sort((a, b) => attentionScore(b) - attentionScore(a));
}

function formatReason(
  reason: AttentionReason,
  copy: PortfolioLabels,
): string {
  switch (reason.kind) {
    case "maintenance":
      return copy.reasonMaintenance(reason.count);
    case "dirty":
      return copy.reasonDirty(reason.count);
    case "highOccupancy":
      return copy.reasonHighOccupancy(reason.pct);
  }
}

export function ChainDashboard({
  user,
  onLogout,
  embedded = false,
  locale,
}: ChainDashboardProps) {
  const copy = labelsFor(locale);
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
            loadError instanceof Error ? loadError.message : copy.loadError,
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
      maintenance: acc.maintenance + hotel.rooms.maintenance,
      activeBookings: acc.activeBookings + hotel.bookings.active,
    }),
    { rooms: 0, occupied: 0, dirty: 0, maintenance: 0, activeBookings: 0 },
  );

  const networkOccPct =
    totals && totals.rooms > 0
      ? Math.round((totals.occupied / totals.rooms) * 100)
      : 0;

  const attentionItems = useMemo(
    () => (overview ? buildAttentionItems(overview.hotels) : []),
    [overview],
  );

  return (
    <div className={embedded ? "dash dash--embedded" : "dash"}>
      <header className="dash__header">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{overview?.tenantName ?? copy.titleFallback}</h1>
          <p className="sub">
            {user.displayName} ·{" "}
            {copy.hotelsInChain(overview?.hotelCount ?? "—")}
          </p>
        </div>
        {embedded ? null : (
          <div className="actions">
            <a className="link" href={APP_URLS.admin}>
              {copy.openHotelOps}
            </a>
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                void logout().then(onLogout);
              }}
            >
              {copy.logout}
            </Button>
          </div>
        )}
      </header>

      {loading ? <p className="state">{copy.loading}</p> : null}
      {error !== undefined ? (
        <p className="state state--error" role="alert">
          {error}
        </p>
      ) : null}

      {totals ? (
        <section className="kpi-row" aria-label={copy.kpiAria}>
          <article className="kpi">
            <strong>{overview?.hotelCount}</strong>
            <p>{copy.kpiHotels}</p>
          </article>
          <article className="kpi kpi--accent">
            <strong>{networkOccPct}%</strong>
            <p>
              {copy.kpiOccupancy} · {totals.occupied}/{totals.rooms}
            </p>
          </article>
          <article
            className={
              totals.dirty + totals.maintenance > 0
                ? "kpi kpi--warn"
                : "kpi"
            }
          >
            <strong>{totals.dirty + totals.maintenance}</strong>
            <p>{copy.kpiDirty}</p>
          </article>
          <article className="kpi">
            <strong>{totals.activeBookings}</strong>
            <p>{copy.kpiBookings}</p>
          </article>
        </section>
      ) : null}

      {overview ? (
        <section
          className={
            attentionItems.length > 0
              ? "attention attention--active"
              : "attention attention--clear"
          }
          aria-label={copy.attentionTitle}
        >
          <h2>{copy.attentionTitle}</h2>
          {attentionItems.length === 0 ? (
            <p className="attention__none">{copy.attentionNone}</p>
          ) : (
            <ul className="attention__list">
              {attentionItems.map((item) => (
                <li key={item.hotelId} className="attention__item">
                  <div className="attention__body">
                    <strong>{item.hotelName}</strong>
                    <ul className="attention__reasons">
                      {item.reasons.map((reason) => (
                        <li key={`${item.hotelId}-${reason.kind}`}>
                          {formatReason(reason, copy)}
                        </li>
                      ))}
                    </ul>
                    <p className="attention__context">
                      {copy.activeBookingsContext(item.activeBookings)}
                    </p>
                  </div>
                  <a
                    className="attention__action"
                    href={`${APP_URLS.admin}?hotelId=${item.hotelId}`}
                  >
                    {copy.attentionOpenOps}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section className="card">
        <h2>{copy.hotelsTitle}</h2>
        <p className="hint">{copy.hotelsHint}</p>
        {overview ? (
          <ul className="hotel-grid">
            {overview.hotels.map((hotel) => {
              const occ = hotelOccupancyPct(hotel);
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
                      <dt>{copy.metricOccupancy}</dt>
                      <dd>{occ}%</dd>
                    </div>
                    <div>
                      <dt>{copy.metricVacant}</dt>
                      <dd>{hotel.rooms.vacant}</dd>
                    </div>
                    <div>
                      <dt>{copy.metricDirty}</dt>
                      <dd>{hotel.rooms.dirty}</dd>
                    </div>
                    <div>
                      <dt>{copy.metricMaintenance}</dt>
                      <dd>{hotel.rooms.maintenance}</dd>
                    </div>
                    <div className="metrics__wide">
                      <dt>{copy.metricActiveBookings}</dt>
                      <dd>{hotel.bookings.active}</dd>
                    </div>
                  </dl>
                  <a
                    className="open-ops"
                    href={`${APP_URLS.admin}?hotelId=${hotel.id}`}
                  >
                    {copy.openHotelOps}
                  </a>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      <style>{`
        .dash { min-height:100vh; padding:clamp(1.25rem,3vw,2.5rem); display:grid; gap:var(--space-4); align-content:start; }
        .dash--embedded { min-height:unset; padding:0; gap:var(--space-3); }
        .dash__header { display:flex; justify-content:space-between; gap:var(--space-4); align-items:start; }
        .dash--embedded .dash__header h1 { font-size:clamp(1.35rem,4vw,1.75rem); }
        .dash--embedded .eyebrow { margin-bottom:var(--space-1); font-size:.72rem; }
        .actions { display:flex; gap:var(--space-3); align-items:center; }
        .link { color:var(--color-sea-deep); font-weight:600; }
        .eyebrow { margin:0 0 var(--space-2); letter-spacing:.08em; text-transform:uppercase; font-size:var(--text-small); color:var(--color-sea-deep); font-weight:700; }
        h1 { font-size:var(--text-display); margin:0; line-height:1.15; }
        .sub { margin:var(--space-1) 0 0; color:var(--color-ink-soft); font-size:var(--text-small); }
        .kpi-row { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:var(--space-2); }
        .kpi { background:rgb(255 250 242 / 90%); border:1px solid rgb(16 36 31 / 10%); border-radius:var(--radius-md); padding:var(--space-3); box-shadow:var(--shadow-soft); }
        .kpi strong { display:block; font-family:var(--font-display); font-size:1.65rem; line-height:1.1; }
        .kpi p { margin:var(--space-1) 0 0; color:var(--color-ink-soft); font-size:.78rem; line-height:1.35; }
        .kpi--accent { border-color:rgb(15 106 92 / 22%); background:rgb(15 106 92 / 6%); }
        .kpi--accent strong { color:var(--color-sea-deep); }
        .kpi--warn { border-color:rgb(180 83 9 / 28%); background:rgb(180 83 9 / 8%); }
        .kpi--warn strong { color:#9a3412; }
        .attention { border-radius:calc(var(--radius-md) + .1rem); padding:clamp(.9rem,2vw,1.25rem); }
        .attention--active { background:rgb(180 83 9 / 7%); border:1px solid rgb(180 83 9 / 22%); box-shadow:var(--shadow-soft); }
        .attention--clear { background:rgb(15 106 92 / 6%); border:1px solid rgb(15 106 92 / 16%); }
        .attention h2 { margin:0 0 var(--space-2); font-size:1.05rem; }
        .attention__none { margin:0; color:var(--color-ink-soft); font-size:var(--text-small); }
        .attention__list { list-style:none; margin:0; padding:0; display:grid; gap:var(--space-2); }
        .attention__item { display:flex; justify-content:space-between; align-items:center; gap:var(--space-3); padding:var(--space-3); border-radius:var(--radius-sm); background:var(--color-paper-elevated); border:1px solid rgb(16 36 31 / 10%); }
        .attention__body { min-width:0; }
        .attention__body > strong { display:block; font-family:var(--font-display); font-size:1rem; }
        .attention__reasons { list-style:none; margin:var(--space-1) 0 0; padding:0; display:grid; gap:.15rem; }
        .attention__reasons li { font-size:var(--text-small); font-weight:600; color:#9a3412; }
        .attention__context { margin:var(--space-1) 0 0; font-size:.75rem; color:var(--color-ink-soft); }
        .attention__action { flex-shrink:0; font-weight:700; color:var(--color-sea-deep); white-space:nowrap; padding:.45rem .75rem; border-radius:var(--radius-sm); border:1px solid rgb(15 106 92 / 22%); background:rgb(15 106 92 / 8%); }
        .attention__action:focus-visible { outline:2px solid var(--color-sea-deep); outline-offset:2px; }
        .card { background:rgb(255 250 242 / 90%); border:1px solid rgb(16 36 31 / 10%); border-radius:calc(var(--radius-md) + .1rem); box-shadow:var(--shadow-soft); padding:clamp(1rem,2.5vw,1.6rem); }
        .card h2 { margin:0; font-size:var(--text-title); }
        .hint { margin:var(--space-2) 0 var(--space-3); color:var(--color-ink-soft); font-size:var(--text-small); }
        .hotel-grid { list-style:none; margin:0; padding:0; display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:var(--space-3); }
        .hotel-card { display:grid; gap:var(--space-3); padding:var(--space-3); border:1px solid rgb(16 36 31 / 10%); border-radius:var(--radius-sm); background:var(--color-paper-elevated); }
        .hotel-card h3 { margin:0; font-family:var(--font-display); font-size:1.05rem; }
        .hotel-card > div > p { margin:var(--space-1) 0 0; color:var(--color-ink-soft); font-size:var(--text-small); }
        .metrics { margin:0; display:grid; grid-template-columns:1fr 1fr; gap:var(--space-2); }
        .metrics div { display:grid; gap:.1rem; }
        .metrics__wide { grid-column:1 / -1; }
        .metrics dt { font-size:.75rem; color:var(--color-ink-soft); }
        .metrics dd { margin:0; font-weight:700; }
        .open-ops { display:inline-block; font-weight:700; color:var(--color-sea-deep); font-size:var(--text-small); }
        .state { margin:0; color:var(--color-ink-soft); }
        .state--error { color:var(--color-danger); }
        @media (max-width:900px){ .kpi-row{ grid-template-columns:repeat(2,minmax(0,1fr)); } }
        @media (max-width:768px){
          .dash--embedded .attention--active{
            position:sticky;
            top:calc(var(--space-2) + 0px);
            z-index:2;
          }
          .attention__item{ flex-direction:column; align-items:stretch; }
          .attention__action{ text-align:center; }
        }
      `}</style>
    </div>
  );
}
