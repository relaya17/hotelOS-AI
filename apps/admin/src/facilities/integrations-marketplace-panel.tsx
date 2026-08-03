import { useEffect, useState } from "react";
import { Button } from "@hotelos/ui";
import {
  fetchHotelTwin,
  fetchIntegrationsCatalog,
  putHotelIntegrationDomains,
  type IntegrationDomainDto,
  type IntegrationDomainStatus,
  type IntegrationsCatalogDto,
} from "@hotelos/web-client";

export type IntegrationsMarketplacePanelProps = {
  readonly hotelId: string;
};

const STATUS_LABELS: Record<IntegrationDomainStatus, string> = {
  adapters: "מחברים",
  mvp: "MVP",
  deferred: "דחוי",
};

function statusBadgeClass(status: IntegrationDomainStatus): string {
  if (status === "adapters") return "badge badge--adapters";
  if (status === "deferred") return "badge badge--deferred";
  return "badge badge--mvp";
}

function DomainCard({
  domain,
  enabled,
  locked,
  onToggle,
}: {
  readonly domain: IntegrationDomainDto;
  readonly enabled: boolean;
  readonly locked: boolean;
  readonly onToggle: (domainId: string, next: boolean) => void;
}) {
  return (
    <article
      className={`integration-card${locked ? " integration-card--locked" : ""}`}
    >
      <header className="integration-card__header">
        <label className="integration-card__toggle">
          <input
            type="checkbox"
            checked={enabled}
            disabled={locked}
            onChange={(event) => onToggle(domain.id, event.target.checked)}
          />
          <h3>{domain.titleHe}</h3>
        </label>
        <span className={statusBadgeClass(domain.status)}>
          {locked ? "נעול" : STATUS_LABELS[domain.status]}
        </span>
      </header>
      <p className="integration-card__id">{domain.id}</p>
      {locked ? (
        <p className="integration-card__lock-note">
          דומיין דחוי — לא ניתן להפעלה בפיילוט.
        </p>
      ) : null}
      <ul className="integration-card__examples">
        {domain.examples.map((example) => (
          <li key={example}>{example}</li>
        ))}
      </ul>
    </article>
  );
}

export function IntegrationsMarketplacePanel({
  hotelId,
}: IntegrationsMarketplacePanelProps) {
  const [catalog, setCatalog] = useState<IntegrationsCatalogDto | null>(null);
  const [enabledIds, setEnabledIds] = useState<readonly string[]>([]);
  const [twinPmsProvider, setTwinPmsProvider] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(undefined);
      setSavedNote(undefined);
      try {
        const [catalogData, twin] = await Promise.all([
          fetchIntegrationsCatalog(hotelId),
          fetchHotelTwin(hotelId).catch(() => null),
        ]);
        if (cancelled) return;
        setCatalog(catalogData);
        setEnabledIds(catalogData.enabledForHotel ?? []);
        setTwinPmsProvider(twin?.pms?.providerId);
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
  }, [hotelId]);

  function onToggle(domainId: string, next: boolean) {
    setSavedNote(undefined);
    setEnabledIds((current) =>
      next
        ? [...new Set([...current, domainId])]
        : current.filter((id) => id !== domainId),
    );
  }

  async function onSave() {
    setSaving(true);
    setError(undefined);
    setSavedNote(undefined);
    try {
      const result = await putHotelIntegrationDomains(hotelId, enabledIds);
      setEnabledIds(result.enabled);
      setSavedNote("העדפות דומיינים נשמרו.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "שמירה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>טוען קטלוג אינטגרציות…</p>;

  const envPms = catalog?.live.pmsProvider;
  const activePms = twinPmsProvider ?? envPms;

  return (
    <section className="integrations-marketplace">
      <h2>שוק אינטגרציות · קטלוג מודולים</h2>
      <p className="muted">
        בוחרים דומיינים לפיילוט — העדפה בלבד, ללא שמירת סודות או התקנה מזויפת.
        חיבור live = קונפיגורציה / פרויקט ספק.
      </p>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {savedNote ? <p className="hint">{savedNote}</p> : null}

      <div className="integrations-marketplace__actions">
        <Button type="button" disabled={saving} onClick={() => void onSave()}>
          {saving ? "שומר…" : "שמירת העדפות"}
        </Button>
      </div>

      <div className="integrations-marketplace__live">
        <h3>PMS פעיל</h3>
        {activePms ? (
          <p>
            <strong>{activePms}</strong>
            {twinPmsProvider && envPms && twinPmsProvider !== envPms ? (
              <span className="hint">
                {" "}
                · Twin: {twinPmsProvider} · env: {envPms}
              </span>
            ) : envPms && !twinPmsProvider ? (
              <span className="hint"> · מקור: קונפיגורציית שרת</span>
            ) : twinPmsProvider ? (
              <span className="hint"> · מקור: Digital Twin</span>
            ) : null}
          </p>
        ) : (
          <p className="hint">לא זוהה PMS פעיל — בדקו PMS_PROVIDER או סנכרון Twin.</p>
        )}
        {envPms === "mews" ? (
          <p className={catalog?.live.mewsConfigured ? "hint" : "error"}>
            {catalog?.live.mewsConfigured
              ? "Mews live: טוקנים מוגדרים בשרת (מוכן לסנכרון Twin)."
              : "Mews live נבחר אבל חסרים MEWS_CLIENT_TOKEN / MEWS_ACCESS_TOKEN — השרת ייפול ל־demo עד שיסופקו."}
          </p>
        ) : (
          <p className="hint">
            לפיילוט live: הגדירו PMS_PROVIDER=mews + טוקני Mews ב־.env (קריאה בלבד
            ל־Twin — לא מחליף PMS).
          </p>
        )}
      </div>

      <div className="integrations-marketplace__grid">
        {catalog?.domains.map((domain) => (
          <DomainCard
            key={domain.id}
            domain={domain}
            enabled={enabledIds.includes(domain.id)}
            locked={domain.status === "deferred"}
            onToggle={onToggle}
          />
        ))}
      </div>

      <style>{`
        .integrations-marketplace { display: grid; gap: var(--space-4, 1rem); }
        .muted { opacity: .75; margin: 0; }
        .error { color: var(--color-danger, #8b1e1e); margin: 0; }
        .hint { opacity: .8; font-size: var(--text-small, .875rem); margin: 0; }
        .integrations-marketplace__actions { display: flex; gap: .75rem; }
        .integrations-marketplace__live {
          padding: .85rem 1rem;
          border: 1px solid var(--color-line-strong, rgb(16 36 31 / 12%));
          border-radius: var(--radius-sm, 8px);
          background: rgb(16 36 31 / 3%);
        }
        .integrations-marketplace__live h3 { margin: 0 0 .35rem; font-size: 1rem; }
        .integrations-marketplace__live p { margin: 0; }
        .integrations-marketplace__grid {
          display: grid;
          gap: var(--space-3, .75rem);
          grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
        }
        .integration-card {
          padding: 1rem;
          border: 1px solid var(--color-line-strong, rgb(16 36 31 / 12%));
          border-radius: var(--radius-sm, 8px);
          background: #fff;
          display: grid;
          gap: .5rem;
        }
        .integration-card--locked { opacity: .72; background: rgb(16 36 31 / 2%); }
        .integration-card__header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: .5rem;
        }
        .integration-card__toggle {
          display: flex;
          align-items: flex-start;
          gap: .5rem;
          cursor: pointer;
        }
        .integration-card__toggle input { margin-top: .2rem; }
        .integration-card__toggle h3 { margin: 0; font-size: 1rem; line-height: 1.3; }
        .integration-card__id {
          margin: 0;
          font-size: var(--text-small, .875rem);
          opacity: .65;
          font-family: var(--font-mono, monospace);
        }
        .integration-card__lock-note {
          margin: 0;
          font-size: var(--text-small, .875rem);
          opacity: .75;
        }
        .integration-card__examples {
          margin: 0;
          padding-inline-start: 1.1rem;
          font-size: var(--text-small, .875rem);
          display: grid;
          gap: .25rem;
        }
        .badge {
          padding: .15rem .5rem;
          border-radius: var(--radius-sm, 6px);
          font-weight: 700;
          font-size: var(--text-micro, .75rem);
          white-space: nowrap;
        }
        .badge--adapters { background: rgb(16 36 31 / 10%); }
        .badge--mvp { background: var(--color-sea-soft, #e8f4f1); color: var(--color-sea-deep, #103027); }
        .badge--deferred { background: rgb(16 36 31 / 6%); opacity: .85; }
      `}</style>
    </section>
  );
}
