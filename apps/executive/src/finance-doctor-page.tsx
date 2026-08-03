import { useEffect, useState } from "react";
import { Button, TextField } from "@hotelos/ui";
import {
  fetchCfoFinanceBrief,
  fetchCfoMarketSnapshots,
  refreshCfoMarketFeeds,
  synthesizeCfoFinanceBrief,
  type CfoFinanceBriefDto,
  type FinanceDoctorAudience,
  type FinanceDoctorFocus,
  type SynthesizedCfoFinanceBriefDto,
  type TrustedSourceSnapshotDto,
} from "@hotelos/web-client";

const AUDIENCES: readonly { id: FinanceDoctorAudience; label: string }[] = [
  { id: "owner", label: "בעלים" },
  { id: "ceo", label: "מנכ״ל" },
  { id: "cfo", label: "מנכ״ל כספים" },
];

const FOCUSES: readonly { id: FinanceDoctorFocus; label: string }[] = [
  { id: "all", label: "הכל" },
  { id: "finance", label: "כספים" },
  { id: "procurement", label: "קניות" },
  { id: "marketing", label: "פרסום ושיווק" },
];

export function FinanceDoctorPage() {
  const [brief, setBrief] = useState<CfoFinanceBriefDto | null>(null);
  const [smart, setSmart] = useState<SynthesizedCfoFinanceBriefDto | null>(null);
  const [snapshots, setSnapshots] = useState<readonly TrustedSourceSnapshotDto[]>(
    [],
  );
  const [audience, setAudience] = useState<FinanceDoctorAudience>("ceo");
  const [focus, setFocus] = useState<FinanceDoctorFocus>("all");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();

  async function reloadFacts() {
    const [nextBrief, nextSnapshots] = await Promise.all([
      fetchCfoFinanceBrief(),
      fetchCfoMarketSnapshots(),
    ]);
    setBrief(nextBrief);
    setSnapshots(nextSnapshots);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        setError(undefined);
        await reloadFacts();
      } catch (loadError: unknown) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "טעינה נכשלה",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="finance-doctor">
      <header>
        <p className="hotelos-eyebrow">Finance Doctor · בעלים · מנכ״ל · CFO</p>
        <h1>יועץ הנהלה חכם</h1>
        <p className="sub">
          עוזר בקניות, בפרסום ובשיווק — וגם בתזרים ובצמיחה. מותאם לבעלים,
          למנכ״ל ולמנכ״ל הכספים. עובדות חיצוניות רק ממקורות Trusted; ביצוע כספי
          רק אחרי אישור אדם.
        </p>
      </header>

      <section className="chooser" aria-label="קהל יעד">
        <p className="chooser__label">למי לייעץ?</p>
        <div className="hotelos-seg" role="tablist">
          {AUDIENCES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={audience === item.id}
              className={
                audience === item.id
                  ? "hotelos-seg__item hotelos-seg__item--on"
                  : "hotelos-seg__item"
              }
              onClick={() => setAudience(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="chooser" aria-label="מיקוד">
        <p className="chooser__label">במה להתמקד?</p>
        <div className="hotelos-seg" role="tablist">
          {FOCUSES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={focus === item.id}
              className={
                focus === item.id
                  ? "hotelos-seg__item hotelos-seg__item--on"
                  : "hotelos-seg__item"
              }
              onClick={() => setFocus(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <div className="actions">
        <Button
          type="button"
          disabled={busy !== null}
          onClick={() => {
            void (async () => {
              try {
                setBusy("refresh");
                setError(undefined);
                const result = await refreshCfoMarketFeeds();
                await reloadFacts();
                setSmart(null);
                setError(
                  result.failed > 0
                    ? `רענון: ${result.ok}/${result.attempted} הצליחו · ${result.failed} נכשלו`
                    : undefined,
                );
              } catch (refreshError: unknown) {
                setError(
                  refreshError instanceof Error
                    ? refreshError.message
                    : "רענון נכשל",
                );
              } finally {
                setBusy(null);
              }
            })();
          }}
        >
          {busy === "refresh" ? "מרענן Trusted…" : "רענון יומי ממקורות Trusted"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy !== null}
          onClick={() => {
            void (async () => {
              try {
                setBusy("synthesize");
                setError(undefined);
                const result = await synthesizeCfoFinanceBrief({
                  audience,
                  focus,
                  ...(question.trim()
                    ? { questionHe: question.trim() }
                    : {}),
                });
                setSmart(result);
                setBrief(result.brief);
              } catch (synthError: unknown) {
                setError(
                  synthError instanceof Error
                    ? synthError.message
                    : "ניתוח נכשל",
                );
              } finally {
                setBusy(null);
              }
            })();
          }}
        >
          {busy === "synthesize" ? "מנתח…" : "נתח והמלץ עכשיו"}
        </Button>
      </div>

      <TextField
        name="finance-question"
        label="שאלה ספציפית (קנייה / קמפיין / חוזה / תזרים)"
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        placeholder="לדוגמה: האם לקנות מצעים עכשיו או לדחות? איזה קמפיין ימלא את סוף השבוע?"
      />

      {loading ? <p className="state">טוען תדריך…</p> : null}
      {error ? (
        <p className="state state--warn" role="status">
          {error}
        </p>
      ) : null}

      {brief ? (
        <section className="card">
          <h2>{brief.headlineHe}</h2>
          <p className="meta">
            {brief.tenantName} ·{" "}
            {new Date(brief.generatedAt).toLocaleString("he-IL")}
          </p>
          <h3>מלונות</h3>
          <ul>
            {brief.hotelBulletsHe.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <h3>ספר חשבונות</h3>
          <ul>
            {brief.ledgerSummaryHe.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <h3>קניות ורכש</h3>
          <ul>
            {brief.procurementBulletsHe.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <h3>פרסום ושיווק</h3>
          <ul>
            {brief.marketingBulletsHe.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {brief.anomalyBulletsHe.length > 0 ? (
            <>
              <h3>אנומליות</h3>
              <ul>
                {brief.anomalyBulletsHe.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </>
          ) : null}
          <p className="guard">{brief.guardrailHe}</p>
        </section>
      ) : null}

      {smart ? (
        <section className="card card--ai">
          <h2>
            המלצה ל
            {AUDIENCES.find((item) => item.id === smart.audience)?.label ??
              smart.audience}{" "}
            · {smart.agentId}
          </h2>
          <p className="meta">
            מיקוד:{" "}
            {FOCUSES.find((item) => item.id === smart.focus)?.label ??
              smart.focus}{" "}
            · {smart.provider}
          </p>
          <p className="narrative">{smart.narrativeHe}</p>
          {smart.suggestedActionsHe.length > 0 ? (
            <>
              <h3>המלצות להיום</h3>
              <ul>
                {smart.suggestedActionsHe.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            </>
          ) : null}
          {smart.requiresHumanApproval ? (
            <p className="guard">
              נדרש אישור אדם
              {smart.approvalReasonHe ? `: ${smart.approvalReasonHe}` : "."}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="card">
        <h2>עדכוני שוק אחרונים (Trusted)</h2>
        {snapshots.length === 0 ? (
          <p className="hint">
            אין snapshots עדיין — לחצו «רענון יומי» או המתינו ל־cron.
          </p>
        ) : (
          <ul className="snap-list">
            {snapshots.slice(0, 10).map((snap) => (
              <li key={snap.id}>
                <strong>
                  {snap.title}{" "}
                  <span className={snap.status === "ok" ? "ok" : "fail"}>
                    {snap.status === "ok" ? "OK" : "FAILED"}
                  </span>
                </strong>
                <span className="meta">
                  {new Date(snap.fetchedAt).toLocaleString("he-IL")}
                </span>
                {snap.status === "ok" ? (
                  <p>{snap.summary.slice(0, 240)}</p>
                ) : (
                  <p className="fail">{snap.error ?? "שגיאה"}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <style>{`
        .finance-doctor { display:grid; gap:var(--space-5); animation:hotelos-enter var(--motion-med) var(--ease-out) both; }
        .finance-doctor .hotelos-eyebrow { margin-bottom:var(--space-2); }
        h1 { font-size:var(--text-display); margin:0; }
        .sub { margin:var(--space-2) 0 0; color:var(--color-ink-soft); max-width:70ch; font-weight:500; }
        .chooser { display:grid; gap:var(--space-2); }
        .chooser__label { margin:0; font-size:var(--text-small); font-weight:700; color:var(--color-ink-soft); }
        .chooser .hotelos-seg { flex-wrap:wrap; width:fit-content; max-width:100%; }
        .actions { display:flex; flex-wrap:wrap; gap:var(--space-2); }
        .card { background:var(--color-paper-elevated); border:1px solid var(--color-line); border-radius:var(--radius-md); box-shadow:var(--shadow-soft); padding:clamp(1.1rem,2.4vw,1.7rem); display:grid; gap:var(--space-3); }
        .card--ai { border-color:rgb(14 107 92 / 22%); background:linear-gradient(165deg, var(--color-sea-soft), var(--color-paper-elevated) 55%); }
        .card h2 { margin:0; font-size:var(--text-title); }
        .card h3 { margin:0; font-size:var(--text-micro); text-transform:uppercase; letter-spacing:var(--tracking-label); color:var(--color-ink-soft); }
        .card ul { margin:0; padding-inline-start:1.2rem; display:grid; gap:.35rem; }
        .meta { color:var(--color-ink-soft); font-size:var(--text-small); font-weight:500; }
        .guard { margin:0; font-size:var(--text-small); font-weight:600; color:var(--color-sea-deep); }
        .narrative { margin:0; white-space:pre-wrap; line-height:1.55; }
        .hint { margin:0; color:var(--color-ink-soft); font-weight:500; }
        .state { margin:0; color:var(--color-ink-soft); font-weight:500; }
        .state--warn { color:var(--color-warn); }
        .snap-list { list-style:none; margin:0; padding:0; display:grid; gap:var(--space-3); }
        .snap-list li { display:grid; gap:.25rem; padding:var(--space-3); border:1px solid var(--color-line); border-radius:var(--radius-sm); background:#fff; }
        .snap-list p { margin:0; font-size:var(--text-small); color:var(--color-ink-soft); }
        .ok { color:var(--color-sea-deep); font-size:var(--text-micro); }
        .fail { color:var(--color-danger); font-size:var(--text-micro); }
      `}</style>
    </div>
  );
}
