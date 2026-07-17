import { useEffect, useState } from "react";
import { tUi, type LocaleCode } from "@hotelos/i18n";
import { Button } from "@hotelos/ui";
import {
  fetchAutomations,
  runAutomation,
  toggleAutomation,
  type AutomationBundleDto,
} from "@hotelos/web-client";

export type TurboAutomationsPageProps = {
  readonly locale: LocaleCode;
};

export function TurboAutomationsPage({ locale }: TurboAutomationsPageProps) {
  const [data, setData] = useState<AutomationBundleDto | null>(null);
  const [error, setError] = useState<string | undefined>();

  async function reload() {
    setData(await fetchAutomations());
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        await reload();
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "Load failed",
          );
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page">
      <header>
        <p className="eyebrow">Turbo OS</p>
        <h1>{tUi(locale, "automations.title")}</h1>
        <p className="sub">{tUi(locale, "automations.subtitle")}</p>
      </header>
      {error !== undefined ? (
        <p className="err" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="rules">
        {data?.rules.map((rule) => (
          <li key={rule.id}>
            <div>
              <h3>{rule.name}</h3>
              <p>
                {rule.domain} · {rule.triggerKey} → {rule.actionKey}
              </p>
            </div>
            <div className="actions">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  void toggleAutomation(rule.id, !rule.enabled).then(reload);
                }}
              >
                {rule.enabled ? "On" : "Off"}
              </Button>
              <Button
                type="button"
                disabled={!rule.enabled}
                onClick={() => {
                  void runAutomation(rule.id).then(reload);
                }}
              >
                Run
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <section className="card">
        <h2>Recent runs</h2>
        <ul className="runs">
          {data?.runs.map((run) => (
            <li key={run.id}>
              <strong>{run.status}</strong>
              <span>
                {run.detail} · {new Date(run.createdAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <style>{`
        .page{display:grid;gap:var(--space-4)}
        .eyebrow{margin:0 0 var(--space-2);letter-spacing:.08em;text-transform:uppercase;font-size:var(--text-small);color:var(--color-sea-deep);font-weight:700}
        h1{margin:0;font-size:clamp(1.8rem,3vw,2.6rem)}
        .sub{margin:var(--space-2) 0 0;color:var(--color-ink-soft)}
        .rules{list-style:none;margin:0;padding:0;display:grid;gap:var(--space-3)}
        .rules li{display:flex;justify-content:space-between;gap:var(--space-3);align-items:center;padding:var(--space-4);background:rgb(255 250 242 / 92%);border:1px solid rgb(16 36 31 / 10%);border-radius:var(--radius-md);box-shadow:var(--shadow-soft)}
        .rules h3{margin:0;font-family:var(--font-display);font-size:1.1rem}
        .rules p{margin:var(--space-1) 0 0;color:var(--color-ink-soft);font-size:var(--text-small)}
        .actions{display:flex;gap:var(--space-2);flex-shrink:0}
        .card{background:rgb(255 250 242 / 92%);border:1px solid rgb(16 36 31 / 10%);border-radius:var(--radius-md);padding:var(--space-4)}
        .runs{list-style:none;margin:0;padding:0;display:grid;gap:var(--space-2)}
        .runs li{display:grid;gap:.15rem;padding:var(--space-2);border-radius:var(--radius-sm);background:var(--color-paper-elevated)}
        .runs span{font-size:var(--text-small);color:var(--color-ink-soft)}
        .err{color:var(--color-danger)}
        @media (max-width:720px){.rules li{flex-direction:column;align-items:stretch}}
      `}</style>
    </div>
  );
}
