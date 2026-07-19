import { useEffect, useState } from "react";
import { Button } from "@hotelos/ui";
import {
  fetchDailyBriefing,
  suggestAutonomyBriefingAction,
  synthesizeCioDigest,
  type CioRole,
  type DailyBriefingHotelDto,
  type SynthesizedCioDigestDto,
} from "@hotelos/web-client";

type Props = {
  readonly hotelId: string;
};

const ROLE_OPTIONS: readonly { value: CioRole; labelHe: string }[] = [
  { value: "ceo", labelHe: "מנכ״ל" },
  { value: "reception", labelHe: "קבלה" },
  { value: "housekeeping", labelHe: "משק בית" },
  { value: "fb", labelHe: "F&B" },
  { value: "cfo", labelHe: "כספים" },
  { value: "owner", labelHe: "בעלים" },
];

export function DailyBriefingPanel({ hotelId }: Props) {
  const [section, setSection] = useState<DailyBriefingHotelDto | undefined>();
  const [generatedAt, setGeneratedAt] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [role, setRole] = useState<CioRole>("ceo");
  const [smart, setSmart] = useState<SynthesizedCioDigestDto | null>(null);
  const [smartLoading, setSmartLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(undefined);
      try {
        const data = await fetchDailyBriefing();
        if (cancelled) return;
        setGeneratedAt(data.generatedAt);
        setSection(data.hotels.find((hotel) => hotel.hotelId === hotelId));
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "שגיאה בטעינת התדריך",
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

  async function onSynthesize() {
    setSmartLoading(true);
    setError(undefined);
    try {
      setSmart(await synthesizeCioDigest(role));
    } catch (synthError) {
      setError(
        synthError instanceof Error ? synthError.message : "סינתזת תדריך נכשלה",
      );
    } finally {
      setSmartLoading(false);
    }
  }

  async function onSuggestAction(
    actionHe: string,
    source: "daily_briefing" | "cio_digest",
  ) {
    setBusyAction(actionHe);
    setError(undefined);
    try {
      const result = await suggestAutonomyBriefingAction({
        hotelId,
        actionHe,
        roleHint: role,
        source,
      });
      setNotice(
        `Suggest נשלח לאישורי AI → ${result.departmentCode} (${result.approvalId.slice(0, 8)}…). אשרו → Act ייפתח משימה.`,
      );
    } catch (suggestError) {
      setError(
        suggestError instanceof Error
          ? suggestError.message
          : "הצעת פעולה מתדריך נכשלה",
      );
    } finally {
      setBusyAction(undefined);
    }
  }

  return (
    <div className="briefing">
      <header className="briefing__header">
        <div>
          <p className="eyebrow">תדריך יומי · עוזר תפעולי</p>
          <h2>מה חשוב לדעת היום</h2>
        </div>
        {generatedAt ? (
          <p className="generated">
            עודכן: {new Date(generatedAt).toLocaleString("he-IL")}
          </p>
        ) : null}
      </header>

      {loading ? <p className="state">מכין תדריך…</p> : null}
      {error !== undefined ? (
        <p className="state state--error" role="alert">
          {error}
        </p>
      ) : null}
      {notice !== undefined ? (
        <p className="state state--ok" role="status">
          {notice}
        </p>
      ) : null}

      {!loading && !error && !section ? (
        <p className="state">אין עדיין נתונים מספיקים לתדריך למלון הזה.</p>
      ) : null}

      {section ? (
        <div className="briefing__body">
          <p className="summary">{section.summaryHe}</p>

          <div className="metrics">
            <div>
              <dt>תפוסה</dt>
              <dd>{section.occupancyPercent}%</dd>
            </div>
            <div>
              <dt>הזמנות פעילות</dt>
              <dd>{section.activeBookings}</dd>
            </div>
            <div>
              <dt>חדרים לניקיון</dt>
              <dd>{section.roomsNeedingCleaning}</dd>
            </div>
            <div>
              <dt>תחזוקה פתוחה</dt>
              <dd>{section.openMaintenanceRequests}</dd>
            </div>
            <div>
              <dt>דירוג אורחים</dt>
              <dd>
                {section.averageFeedbackRating !== null
                  ? `⭐ ${section.averageFeedbackRating.toFixed(1)}`
                  : "—"}
              </dd>
            </div>
          </div>

          {section.warnings.length > 0 ? (
            <section className="list-block list-block--warn">
              <h3>דורש תשומת לב</h3>
              <ul>
                {section.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {section.highlights.length > 0 ? (
            <section className="list-block list-block--good">
              <h3>נקודות טובות</h3>
              <ul>
                {section.highlights.map((highlight) => (
                  <li key={highlight}>{highlight}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {section.suggestedActions.length > 0 ? (
            <section className="list-block list-block--action">
              <h3>מומלץ לעשות היום</h3>
              <p className="hint">
                Suggest→Approve→Act: שליחה לתיבת אישורי AI כמשימת מחלקה.
              </p>
              <ul className="action-list">
                {section.suggestedActions.map((action) => (
                  <li key={action}>
                    <span>{action}</span>
                    <Button
                      type="button"
                      disabled={busyAction === action}
                      onClick={() =>
                        void onSuggestAction(action, "daily_briefing")
                      }
                    >
                      {busyAction === action ? "שולח…" : "Suggest"}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      <section className="smart-card">
        <h3>תדריך חכם לפי תפקיד (CIO + Gateway)</h3>
        <p className="hint">
          סיכום AI מעל נתוני התפעול — המלצות בלבד; Suggest שולח לאישור לפני Act.
        </p>
        <div className="smart-row">
          <label>
            תפקיד
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as CioRole)}
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.labelHe}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            disabled={smartLoading}
            onClick={() => void onSynthesize()}
          >
            {smartLoading ? "מסכם…" : "סכם עם AI"}
          </Button>
        </div>
        {smart ? (
          <div className="smart-result">
            <p className="narrative">{smart.narrativeHe}</p>
            {smart.suggestedActionsHe.length > 0 ? (
              <ul className="action-list">
                {smart.suggestedActionsHe.map((action) => (
                  <li key={action}>
                    <span>{action}</span>
                    <Button
                      type="button"
                      disabled={busyAction === action}
                      onClick={() =>
                        void onSuggestAction(action, "cio_digest")
                      }
                    >
                      {busyAction === action ? "שולח…" : "Suggest"}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="hint">
              {smart.provider} · {smart.latencyMs}ms
            </p>
          </div>
        ) : null}
      </section>

      <style>{`
        .briefing { display:grid; gap:var(--space-4); }
        .briefing__header { display:flex; justify-content:space-between; align-items:flex-end; gap:var(--space-3); flex-wrap:wrap; }
        .eyebrow { margin:0 0 var(--space-2); letter-spacing:.08em; text-transform:uppercase; font-size:var(--text-small); color:var(--color-sea-deep); font-weight:700; }
        h2 { margin:0; font-size:var(--text-title); font-family:var(--font-display); }
        .generated { margin:0; color:var(--color-ink-soft); font-size:var(--text-small); }
        .state { margin:0; color:var(--color-ink-soft); }
        .state--error { color:var(--color-danger); }
        .state--ok { color:#0f6a5c; background:rgb(15 106 92 / 10%); padding:.75rem 1rem; border-radius:var(--radius-sm); }
        .briefing__body { display:grid; gap:var(--space-4); background:rgb(255 250 242 / 90%); border:1px solid rgb(16 36 31 / 10%); border-radius:var(--radius-md); padding:clamp(1.2rem,2.5vw,1.8rem); box-shadow:var(--shadow-soft); }
        .summary { margin:0; font-weight:600; font-size:1.05rem; }
        .metrics { margin:0; display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:var(--space-3); }
        .metrics div { display:grid; gap:.15rem; background:var(--color-paper-elevated); border:1px solid rgb(16 36 31 / 8%); border-radius:var(--radius-sm); padding:var(--space-3); }
        .metrics dt { margin:0; font-size:var(--text-small); color:var(--color-ink-soft); }
        .metrics dd { margin:0; font-weight:700; font-size:1.1rem; }
        .list-block { display:grid; gap:var(--space-2); }
        .list-block h3 { margin:0; font-size:var(--text-small); text-transform:uppercase; letter-spacing:.06em; }
        .list-block ul { margin:0; padding-inline-start:1.2rem; display:grid; gap:.35rem; }
        .list-block--warn h3 { color:#b3541e; }
        .list-block--good h3 { color:var(--color-sea-deep); }
        .list-block--action h3 { color:var(--color-ink-soft); }
        .action-list { list-style:none; padding:0; margin:0; display:grid; gap:.5rem; }
        .action-list li { display:flex; justify-content:space-between; gap:.75rem; align-items:center; padding:.65rem .75rem; border:1px solid rgb(16 36 31 / 10%); border-radius:var(--radius-sm); background:var(--color-paper-elevated); }
        .action-list li span { flex:1; }
        .smart-card { display:grid; gap:var(--space-3); background:rgb(255 250 242 / 90%); border:1px dashed rgb(16 36 31 / 22%); border-radius:var(--radius-md); padding:clamp(1.2rem,2.5vw,1.8rem); }
        .smart-card h3 { margin:0; font-family:var(--font-display); }
        .hint { margin:0; color:var(--color-ink-soft); font-size:var(--text-small); }
        .smart-row { display:flex; gap:var(--space-3); align-items:end; flex-wrap:wrap; }
        .smart-row label { display:grid; gap:.35rem; font-size:var(--text-small); }
        .smart-row select { font:inherit; padding:.45rem .6rem; border:1px solid rgb(16 36 31 / 18%); border-radius:var(--radius-sm); }
        .smart-result { display:grid; gap:var(--space-2); }
        .narrative { margin:0; white-space:pre-wrap; line-height:1.55; }
        @media (max-width:900px){ .metrics{ grid-template-columns:repeat(2,minmax(0,1fr)); } }
      `}</style>
    </div>
  );
}
