import { useEffect, useState } from "react";
import { Button, TextField } from "@hotelos/ui";
import {
  APP_URLS,
  fetchCfoFinanceBrief,
  synthesizeCfoFinanceBrief,
  type CfoFinanceBriefDto,
  type FinanceDoctorAudience,
  type FinanceDoctorFocus,
  type SynthesizedCfoFinanceBriefDto,
} from "@hotelos/web-client";

export type FinancePanelProps = {
  readonly roles: readonly string[];
};

const FINANCE_ROLES = [
  "gm",
  "admin",
  "executive",
  "owner",
] as const;

const AUDIENCES: readonly { id: FinanceDoctorAudience; label: string }[] = [
  { id: "gm", label: "מנהל מלון" },
  { id: "ceo", label: "מנכ״ל" },
  { id: "cfo", label: "מנכ״ל כספים" },
  { id: "owner", label: "בעלים" },
];

const FOCUSES: readonly { id: FinanceDoctorFocus; label: string }[] = [
  { id: "all", label: "הכל" },
  { id: "finance", label: "כספים" },
  { id: "procurement", label: "קניות" },
  { id: "marketing", label: "שיווק" },
];

export function canAccessFinancePanel(roles: readonly string[]): boolean {
  return FINANCE_ROLES.some((role) => roles.includes(role));
}

export function FinancePanel({ roles }: FinancePanelProps) {
  const [brief, setBrief] = useState<CfoFinanceBriefDto | null>(null);
  const [smart, setSmart] = useState<SynthesizedCfoFinanceBriefDto | null>(
    null,
  );
  const [audience, setAudience] = useState<FinanceDoctorAudience>(
    roles.includes("gm") ? "gm" : "ceo",
  );
  const [focus, setFocus] = useState<FinanceDoctorFocus>("finance");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(undefined);
      try {
        const nextBrief = await fetchCfoFinanceBrief();
        if (!cancelled) setBrief(nextBrief);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "טעינת תדריך נכשלה",
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

  async function onSynthesize() {
    setBusy(true);
    setError(undefined);
    try {
      const result = await synthesizeCfoFinanceBrief({
        audience,
        focus,
        ...(question.trim() ? { questionHe: question.trim() } : {}),
      });
      setSmart(result);
      setBrief(result.brief);
    } catch (synthError) {
      setError(
        synthError instanceof Error ? synthError.message : "ניתוח AI נכשל",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="finance-panel" aria-labelledby="finance-panel-title">
      <header className="finance-panel__head">
        <h2 id="finance-panel-title">תדריך כספים (CFO)</h2>
        <p>
          קריאה בלבד + ניתוח AI אופציונלי. Work לא מבצע פעולות כסף — לאישור
          והפעלה פנו ל־Executive או Admin.
        </p>
      </header>

      {loading ? <p className="finance-panel__state">טוען תדריך…</p> : null}
      {error ? (
        <p className="finance-panel__error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="finance-panel__card" aria-label="הגדרות ניתוח">
        <p className="finance-panel__label">קהל יעד</p>
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

        <p className="finance-panel__label">מיקוד</p>
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

        <TextField
          name="finance-question"
          label="שאלה (אופציונלי)"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="לדוגמה: מה מצב תזרים השבוע?"
        />

        <Button
          type="button"
          disabled={busy || loading}
          onClick={() => void onSynthesize()}
        >
          {busy ? "מנתח…" : "נתח והמלץ (AI)"}
        </Button>
      </section>

      {brief ? (
        <section className="finance-panel__card" aria-labelledby="brief-title">
          <h3 id="brief-title">{brief.headlineHe}</h3>
          <p className="finance-panel__meta">
            {brief.tenantName} ·{" "}
            {new Date(brief.generatedAt).toLocaleString("he-IL")}
          </p>
          <ul className="finance-panel__list">
            {brief.hotelBulletsHe.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {brief.ledgerSummaryHe.length > 0 ? (
            <>
              <p className="finance-panel__label">ספר חשבונות</p>
              <ul className="finance-panel__list">
                {brief.ledgerSummaryHe.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </>
          ) : null}
          {brief.anomalyBulletsHe.length > 0 ? (
            <>
              <p className="finance-panel__label">אנומליות</p>
              <ul className="finance-panel__list">
                {brief.anomalyBulletsHe.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </>
          ) : null}
          <p className="finance-panel__guard">{brief.guardrailHe}</p>
        </section>
      ) : null}

      {smart ? (
        <section
          className="finance-panel__card finance-panel__card--ai"
          aria-labelledby="smart-title"
        >
          <h3 id="smart-title">ניתוח AI</h3>
          <p className="finance-panel__meta">
            {AUDIENCES.find((item) => item.id === smart.audience)?.label ??
              smart.audience}{" "}
            · {FOCUSES.find((item) => item.id === smart.focus)?.label ??
              smart.focus}{" "}
            · {smart.provider}
          </p>
          <p className="finance-panel__narrative">{smart.narrativeHe}</p>
          {smart.suggestedActionsHe.length > 0 ? (
            <>
              <p className="finance-panel__label">המלצות (קריאה בלבד)</p>
              <ul className="finance-panel__list">
                {smart.suggestedActionsHe.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            </>
          ) : null}
          {smart.requiresHumanApproval ? (
            <p className="finance-panel__guard">
              נדרש אישור אדם
              {smart.approvalReasonHe ? `: ${smart.approvalReasonHe}` : "."}
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="finance-panel__links">
        <a href={APP_URLS.executive}>Executive HQ → יועץ הנהלה מלא</a>
        <a href={APP_URLS.admin}>Admin → אישורי AI</a>
      </div>

      <style>{`
        .finance-panel { display: grid; gap: var(--space-4); }
        .finance-panel__head { display: grid; gap: var(--space-2); }
        .finance-panel__head h2 {
          font-size: clamp(1.35rem, 2.5vw, 1.7rem);
          color: var(--color-sea-deep);
          margin: 0;
        }
        .finance-panel__head p {
          margin: 0;
          color: var(--color-ink-soft);
          font-weight: 500;
          line-height: 1.6;
          max-width: 46ch;
        }
        .finance-panel__card {
          display: grid;
          gap: var(--space-3);
          padding: var(--space-4);
          border: 1px solid var(--color-line);
          border-radius: var(--radius-md);
          background: var(--color-paper-elevated);
          box-shadow: var(--shadow-soft);
        }
        .finance-panel__card--ai {
          border-color: rgb(14 107 92 / 22%);
          background: linear-gradient(
            165deg,
            var(--color-sea-soft),
            var(--color-paper-elevated) 55%
          );
        }
        .finance-panel__card h3 {
          margin: 0;
          font-size: 1.1rem;
          color: var(--color-sea-deep);
        }
        .finance-panel__label {
          margin: 0;
          font-size: var(--text-small);
          font-weight: 700;
          color: var(--color-ink-soft);
        }
        .finance-panel__card .hotelos-seg { flex-wrap: wrap; width: fit-content; max-width: 100%; }
        .finance-panel__list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 0.35rem;
          font-size: var(--text-small);
          color: var(--color-ink-soft);
          font-weight: 500;
        }
        .finance-panel__meta {
          margin: 0;
          color: var(--color-ink-soft);
          font-size: var(--text-small);
          font-weight: 500;
        }
        .finance-panel__narrative {
          margin: 0;
          white-space: pre-wrap;
          line-height: 1.55;
          font-weight: 500;
        }
        .finance-panel__guard {
          margin: 0;
          font-size: var(--text-small);
          font-weight: 600;
          color: var(--color-sea-deep);
        }
        .finance-panel__state {
          margin: 0;
          color: var(--color-ink-faint);
          font-weight: 500;
        }
        .finance-panel__error {
          margin: 0;
          color: var(--color-danger);
          font-weight: 600;
          font-size: var(--text-small);
        }
        .finance-panel__links {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-3);
        }
        .finance-panel__links a {
          color: var(--color-sea-deep);
          font-weight: 700;
          font-size: var(--text-small);
          text-decoration: none;
        }
        .finance-panel__links a:hover { text-decoration: underline; }
      `}</style>
    </section>
  );
}
