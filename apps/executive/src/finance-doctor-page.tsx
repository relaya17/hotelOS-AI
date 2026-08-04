import { useEffect, useState } from "react";
import { Button, CitationList, TextField } from "@hotelos/ui";
import {
  fetchCfoFinanceBrief,
  fetchCfoMarketSnapshots,
  refreshCfoMarketFeeds,
  suggestAutonomyBriefingAction,
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
  { id: "gm", label: "מנהל מלון" },
  { id: "procurement", label: "רכש / קניין" },
];

const FOCUSES: readonly { id: FinanceDoctorFocus; label: string }[] = [
  { id: "all", label: "הכל" },
  { id: "finance", label: "כספים" },
  { id: "procurement", label: "קניות" },
  { id: "marketing", label: "פרסום ושיווק" },
  { id: "investment", label: "השקעות (חינוכי)" },
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
  const [notice, setNotice] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  const primaryHotelId = brief?.hotels[0]?.id;

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
        <p className="hotelos-eyebrow">
          ניהול נכון · קניין · שיווק · זיכרון אורחים · אוטומציה
        </p>
        <h1>יועץ הנהלה חכם</h1>
        <p className="sub">
          לבעלים, מנכ״ל, מנכ״ל כספים, מנהל מלון ורכש — קניות, פרסום, שיווק,
          תזרים, ואוריינות השקעות (חינוכי בלבד). זוכר אורחים במסד נתונים, ושולח
          המלצות לאישור AI (Suggest→Approve→Act).
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
                setNotice(undefined);
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
                setNotice(undefined);
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
        label="שאלה (קנייה / קמפיין / השקעה חינוכית / אורח / תזרים)"
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        placeholder="לדוגמה: האם לדחות רכש? איזה קמפיין? מה אומר המקרו על נזילות הרשת?"
      />

      {loading ? <p className="state">טוען תדריך…</p> : null}
      {error ? (
        <p className="state state--warn" role="status">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="state state--ok" role="status">
          {notice}
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
          <h3>קניות / קניין</h3>
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
          <h3>זיכרון אורחים</h3>
          <ul>
            {brief.guestMemoryBulletsHe.map((line) => (
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
          {smart.citations?.length ? (
            <CitationList citations={smart.citations} />
          ) : null}
          {smart.suggestedActionsHe.length > 0 ? (
            <>
              <h3>המלצות להיום — שליחה לאוטומציה (Suggest)</h3>
              <ul className="action-list">
                {smart.suggestedActionsHe.map((action) => (
                  <li key={action}>
                    <span>{action}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busy !== null || !primaryHotelId}
                      onClick={() => {
                        if (!primaryHotelId) return;
                        void (async () => {
                          try {
                            setBusy("suggest");
                            setError(undefined);
                            const result = await suggestAutonomyBriefingAction({
                              hotelId: primaryHotelId,
                              actionHe: action,
                              source: "finance_doctor",
                              roleHint:
                                audience === "gm" || audience === "procurement"
                                  ? "ceo"
                                  : audience === "owner"
                                    ? "owner"
                                    : audience === "cfo"
                                      ? "cfo"
                                      : "ceo",
                            });
                            setNotice(
                              `Suggest נשלח לאישורי AI → ${result.departmentCode} (${result.approvalId.slice(0, 8)}…).`,
                            );
                          } catch (suggestError: unknown) {
                            setError(
                              suggestError instanceof Error
                                ? suggestError.message
                                : "שליחת Suggest נכשלה",
                            );
                          } finally {
                            setBusy(null);
                          }
                        })();
                      }}
                    >
                      Suggest
                    </Button>
                  </li>
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
          {smart.focus === "investment" ? (
            <p className="guard">
              השקעות: מידע חינוכי ממקורות Trusted בלבד — אינו ייעוץ השקעות
              מורשה ואין ביצוע מסחר.
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
                  {snap.hasEmbedding ? (
                    <span className="ok"> · embedding ✓</span>
                  ) : null}
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
        .sub { margin:var(--space-2) 0 0; color:var(--color-ink-soft); max-width:72ch; font-weight:500; }
        .chooser { display:grid; gap:var(--space-2); }
        .chooser__label { margin:0; font-size:var(--text-small); font-weight:700; color:var(--color-ink-soft); }
        .chooser .hotelos-seg { flex-wrap:wrap; width:fit-content; max-width:100%; }
        .actions { display:flex; flex-wrap:wrap; gap:var(--space-2); }
        .card { background:var(--color-paper-elevated); border:1px solid var(--color-line); border-radius:var(--radius-md); box-shadow:var(--shadow-soft); padding:clamp(1.1rem,2.4vw,1.7rem); display:grid; gap:var(--space-3); }
        .card--ai { border-color:rgb(14 107 92 / 22%); background:linear-gradient(165deg, var(--color-sea-soft), var(--color-paper-elevated) 55%); }
        .card h2 { margin:0; font-size:var(--text-title); }
        .card h3 { margin:0; font-size:var(--text-micro); text-transform:uppercase; letter-spacing:var(--tracking-label); color:var(--color-ink-soft); }
        .card ul { margin:0; padding-inline-start:1.2rem; display:grid; gap:.35rem; }
        .action-list { list-style:none; padding:0; display:grid; gap:var(--space-2); }
        .action-list li { display:flex; justify-content:space-between; gap:var(--space-3); align-items:center; padding:var(--space-3); border:1px solid var(--color-line); border-radius:var(--radius-sm); background:#fff; }
        .meta { color:var(--color-ink-soft); font-size:var(--text-small); font-weight:500; }
        .guard { margin:0; font-size:var(--text-small); font-weight:600; color:var(--color-sea-deep); }
        .narrative { margin:0; white-space:pre-wrap; line-height:1.55; }
        .hint { margin:0; color:var(--color-ink-soft); font-weight:500; }
        .state { margin:0; color:var(--color-ink-soft); font-weight:500; }
        .state--warn { color:var(--color-warn); }
        .state--ok { color:var(--color-sea-deep); font-weight:600; }
        .snap-list { list-style:none; margin:0; padding:0; display:grid; gap:var(--space-3); }
        .snap-list li { display:grid; gap:.25rem; padding:var(--space-3); border:1px solid var(--color-line); border-radius:var(--radius-sm); background:#fff; }
        .snap-list p { margin:0; font-size:var(--text-small); color:var(--color-ink-soft); }
        .ok { color:var(--color-sea-deep); font-size:var(--text-micro); }
        .fail { color:var(--color-danger); font-size:var(--text-micro); }
      `}</style>
    </div>
  );
}
