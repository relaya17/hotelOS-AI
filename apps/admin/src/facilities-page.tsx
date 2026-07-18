import { useEffect, useState } from "react";
import { listHotels, type HotelDto } from "@hotelos/web-client";
import { ApprovalsPanel } from "./facilities/approvals-panel.js";
import { DailyBriefingPanel } from "./facilities/daily-briefing-panel.js";
import { DepartmentsPanel } from "./facilities/departments-panel.js";
import { FeedbackPanel } from "./facilities/feedback-panel.js";
import { HrPanel } from "./facilities/hr-panel.js";
import { KnowledgePanel } from "./facilities/knowledge-panel.js";
import { MaintenancePanel } from "./facilities/maintenance-panel.js";
import { ProcurementPanel } from "./facilities/procurement-panel.js";
import { RecruitingPanel } from "./facilities/recruiting-panel.js";
import { TwinPanel } from "./facilities/twin-panel.js";

type SubView =
  | "briefing"
  | "departments"
  | "maintenance"
  | "procurement"
  | "feedback"
  | "recruiting"
  | "hr"
  | "approvals"
  | "knowledge"
  | "twin";

const tabs: readonly { readonly key: SubView; readonly label: string }[] = [
  { key: "briefing", label: "תדריך יומי" },
  { key: "departments", label: "מחלקות ומשימות" },
  { key: "maintenance", label: "תחזוקה, תיקונים ושיפוצים" },
  { key: "procurement", label: "רכש ומלאי" },
  { key: "feedback", label: "משוב אורחים" },
  { key: "recruiting", label: "גיוס" },
  { key: "hr", label: "עובדים ותכתובת" },
  { key: "approvals", label: "אישורי AI" },
  { key: "knowledge", label: "ידע ארגוני" },
  { key: "twin", label: "Digital Twin" },
];

function readHotelIdFromUrl(): string | undefined {
  const value = new URLSearchParams(window.location.search).get("hotelId");
  return value && value.length > 0 ? value : undefined;
}

export function FacilitiesPage() {
  const [hotels, setHotels] = useState<readonly HotelDto[]>([]);
  const [selectedHotelId, setSelectedHotelId] = useState<string | undefined>(
    readHotelIdFromUrl(),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [view, setView] = useState<SubView>("briefing");

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

      <nav className="facilities__tabs" aria-label="מחלקות תפעול">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={view === tab.key ? "tab tab--on" : "tab"}
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
          {view === "departments" ? (
            <DepartmentsPanel hotelId={selectedHotelId} />
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
          {view === "twin" ? <TwinPanel hotelId={selectedHotelId} /> : null}
        </div>
      ) : null}

      <style>{`
        .facilities { display:grid; gap:var(--space-4); }
        .facilities__header { display:flex; justify-content:space-between; gap:var(--space-4); align-items:flex-end; flex-wrap:wrap; }
        .eyebrow { margin:0 0 var(--space-2); letter-spacing:.08em; text-transform:uppercase; font-size:var(--text-small); color:var(--color-sea-deep); font-weight:700; }
        h1 { font-size:var(--text-display); margin:0; }
        .select-field { display:grid; gap:var(--space-2); }
        .select-field span { font-size:var(--text-small); font-weight:600; color:var(--color-ink-soft); }
        .select-field select { font:inherit; border:1px solid rgb(16 36 31 / 18%); border-radius:var(--radius-sm); padding:.65rem .85rem; background:var(--color-paper-elevated); }
        .facilities__tabs { display:flex; flex-wrap:wrap; gap:var(--space-2); }
        .tab { border:1px solid rgb(16 36 31 / 14%); background:transparent; border-radius:var(--radius-sm); padding:.55rem .9rem; font:inherit; cursor:pointer; font-weight:600; }
        .tab--on { background:var(--color-sea-deep); color:#fff; border-color:transparent; }
        .facilities__content { display:grid; }
        .state { margin:0; color:var(--color-ink-soft); }
        .state--error { color:var(--color-danger); }
      `}</style>
    </div>
  );
}
