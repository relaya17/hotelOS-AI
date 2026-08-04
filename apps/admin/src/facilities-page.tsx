import { useEffect, useState } from "react";
import { listHotels, type HotelDto } from "@hotelos/web-client";
import { IncidentCenterPanel, PilotRoiPanel } from "@hotelos/features";
import { ApprovalsPanel } from "./facilities/approvals-panel.js";
import { DailyBriefingPanel } from "./facilities/daily-briefing-panel.js";
import { DepartmentsPanel } from "./facilities/departments-panel.js";
import { FeedbackPanel } from "./facilities/feedback-panel.js";
import { HousekeepingPanel } from "./facilities/housekeeping-panel.js";
import { HrPanel } from "./facilities/hr-panel.js";
import { IntegrationsMarketplacePanel } from "./facilities/integrations-marketplace-panel.js";
import { KnowledgePanel } from "./facilities/knowledge-panel.js";
import { MaintenancePanel } from "./facilities/maintenance-panel.js";
import { ProcurementPanel } from "./facilities/procurement-panel.js";
import { ReceptionPanel } from "./facilities/reception-panel.js";
import { RecruitingPanel } from "./facilities/recruiting-panel.js";
import { SimulatorPanel } from "./facilities/simulator-panel.js";
import { TwinPanel } from "./facilities/twin-panel.js";

type SubView =
  | "briefing"
  | "incidents"
  | "departments"
  | "housekeeping"
  | "reception"
  | "maintenance"
  | "procurement"
  | "feedback"
  | "recruiting"
  | "hr"
  | "approvals"
  | "knowledge"
  | "integrations"
  | "twin"
  | "simulator"
  | "pilot-roi";

const tabs: readonly { readonly key: SubView; readonly label: string }[] = [
  { key: "briefing", label: "תדריך יומי" },
  { key: "incidents", label: "מרכז אירועים" },
  { key: "departments", label: "מחלקות ומשימות" },
  { key: "housekeeping", label: "משק בית" },
  { key: "reception", label: "קבלה" },
  { key: "maintenance", label: "תחזוקה, תיקונים ושיפוצים" },
  { key: "procurement", label: "רכש ומלאי" },
  { key: "feedback", label: "משוב אורחים" },
  { key: "recruiting", label: "גיוס" },
  { key: "hr", label: "עובדים ותכתובת" },
  { key: "approvals", label: "אישורי AI" },
  { key: "knowledge", label: "ידע ארגוני" },
  { key: "integrations", label: "אינטגרציות" },
  { key: "twin", label: "Digital Twin · מצב חדרים" },
  { key: "simulator", label: "סימולטור" },
  { key: "pilot-roi", label: "מדדי פיילוט / ROI" },
];

function readHotelIdFromUrl(): string | undefined {
  const value = new URLSearchParams(window.location.search).get("hotelId");
  return value && value.length > 0 ? value : undefined;
}

function readPanelFromUrl(): SubView | undefined {
  const value = new URLSearchParams(window.location.search).get("panel");
  if (!value) return undefined;
  return tabs.some((tab) => tab.key === value) ? (value as SubView) : undefined;
}

export function FacilitiesPage() {
  const [hotels, setHotels] = useState<readonly HotelDto[]>([]);
  const [selectedHotelId, setSelectedHotelId] = useState<string | undefined>(
    readHotelIdFromUrl(),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [view, setView] = useState<SubView>(
    () => readPanelFromUrl() ?? "briefing",
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(undefined);
      try {
        const data = await listHotels();
        if (cancelled) return;
        setHotels(data);
        const fromUrl = readHotelIdFromUrl();
        const exists = data.some((hotel) => hotel.id === fromUrl);
        if (fromUrl && exists) {
          setSelectedHotelId(fromUrl);
        } else if (data[0]) {
          setSelectedHotelId(data[0].id);
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
  }, []);

  const selectedHotel = hotels.find((hotel) => hotel.id === selectedHotelId);

  return (
    <div className="facilities">
      <header className="facilities__header">
        <div>
          <p className="eyebrow">תפעול מלון · כל המחלקות</p>
          <h1>{selectedHotel?.name ?? "בחרו מלון"}</h1>
        </div>
        {hotels.length > 1 ? (
          <label className="select-field">
            <span>מלון</span>
            <select
              value={selectedHotelId ?? ""}
              onChange={(event) => setSelectedHotelId(event.target.value)}
            >
              {hotels.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>
                  {hotel.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </header>

      {loading ? <p className="state">טוען…</p> : null}
      {error !== undefined ? (
        <p className="state state--error" role="alert">
          {error}
        </p>
      ) : null}

      <nav className="facilities__tabs hotelos-seg hotelos-nav-scroll" aria-label="מחלקות תפעול">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={
              view === tab.key
                ? "hotelos-seg__item hotelos-seg__item--on"
                : "hotelos-seg__item"
            }
            onClick={() => setView(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {selectedHotelId ? (
        <div className="facilities__content">
          {view === "briefing" ? (
            <DailyBriefingPanel hotelId={selectedHotelId} />
          ) : null}
          {view === "incidents" ? (
            <IncidentCenterPanel hotelId={selectedHotelId} compact />
          ) : null}
          {view === "departments" ? (
            <DepartmentsPanel hotelId={selectedHotelId} />
          ) : null}
          {view === "housekeeping" ? (
            <HousekeepingPanel hotelId={selectedHotelId} />
          ) : null}
          {view === "reception" ? (
            <ReceptionPanel hotelId={selectedHotelId} />
          ) : null}
          {view === "maintenance" ? (
            <MaintenancePanel hotelId={selectedHotelId} />
          ) : null}
          {view === "procurement" ? (
            <ProcurementPanel hotelId={selectedHotelId} />
          ) : null}
          {view === "feedback" ? <FeedbackPanel hotelId={selectedHotelId} /> : null}
          {view === "recruiting" ? (
            <RecruitingPanel hotelId={selectedHotelId} />
          ) : null}
          {view === "hr" ? <HrPanel hotelId={selectedHotelId} /> : null}
          {view === "approvals" ? <ApprovalsPanel /> : null}
          {view === "knowledge" ? <KnowledgePanel /> : null}
          {view === "integrations" ? (
            <IntegrationsMarketplacePanel hotelId={selectedHotelId} />
          ) : null}
          {view === "twin" ? <TwinPanel hotelId={selectedHotelId} /> : null}
          {view === "simulator" ? (
            <SimulatorPanel hotelId={selectedHotelId} />
          ) : null}
          {view === "pilot-roi" ? (
            <PilotRoiPanel hotelId={selectedHotelId} compact />
          ) : null}
        </div>
      ) : null}

      <style>{`
        .facilities { display:grid; gap:var(--space-4); animation:hotelos-enter var(--motion-med) var(--ease-out) both; }
        .facilities__header { display:flex; justify-content:space-between; gap:var(--space-4); align-items:flex-end; flex-wrap:wrap; }
        .eyebrow { margin:0 0 var(--space-2); font-family:var(--font-body); letter-spacing:var(--tracking-label); text-transform:uppercase; font-size:var(--text-micro); color:var(--color-sea-deep); font-weight:700; }
        h1 { font-size:clamp(1.7rem,3vw,2.3rem); }
        .select-field { display:grid; gap:var(--space-2); }
        .select-field span { font-size:var(--text-small); font-weight:600; color:var(--color-ink-soft); }
        .select-field select { font:inherit; border:1px solid var(--color-line-strong); border-radius:var(--radius-sm); padding:.65rem .85rem; background:#fff; min-height:2.6rem; }
        .facilities__tabs { width:100%; max-width:100%; }
        .facilities__content { display:grid; min-width:0; }
        @media (min-width:769px){
          .facilities__tabs { flex-wrap:wrap; width:fit-content; }
        }
        @media (max-width:480px){
          .facilities__header { flex-direction:column; align-items:stretch; }
          .select-field select { width:100%; min-height:var(--touch-min, 2.75rem); }
        }
        .state { margin:0; color:var(--color-ink-soft); font-weight:500; }
        .state--error { color:var(--color-danger); }
      `}</style>
    </div>
  );
}
