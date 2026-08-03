import { useEffect, useState } from "react";
import {
  fetchHotelTwin,
  fetchIntegrationsCatalog,
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

function DomainCard({ domain }: { readonly domain: IntegrationDomainDto }) {
  return (
    <article className="integration-card">
      <header className="integration-card__header">
        <h3>{domain.titleHe}</h3>
        <span className={statusBadgeClass(domain.status)}>
          {STATUS_LABELS[domain.status]}
        </span>
      </header>
      <p className="integration-card__id">{domain.id}</p>
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
  const [twinPmsProvider, setTwinPmsProvider] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(undefined);
      try {
        const [catalogData, twin] = await Promise.all([
          fetchIntegrationsCatalog(),
          fetchHotelTwin(hotelId).catch(() => null),
        ]);
        if (cancelled) return;
        setCatalog(catalogData);
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

  if (loading) return <p>טוען קטלוג אינטגרציות…</p>;

  const envPms = catalog?.live.pmsProvider;
  const activePms = twinPmsProvider ?? envPms;

  return (
    <section className="integrations-marketplace">
      <h2>שוק אינטגרציות · קטלוג מודולים</h2>
      <p className="muted">
        קטלוג קריאה בלבד — בוחרים דומיינים לפיילוט; אין התקנה מזויפת או שמירת
        סודות מהממשק. חיבור live = קונפיגורציה / פרויקט ספק.
      </p>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

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
          <DomainCard key={domain.id} domain={domain} />
        ))}
      </div>

      <style>{`
        .integrations-marketplace { display: grid; gap: var(--space-4, 1rem); }
        .muted { opacity: .75; margin: 0; }
        .error { color: var(--color-danger, #8b1e1e); margin: 0; }
        .hint { opacity: .8; font-size: var(--text-small, .875rem); }
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
        .integration-card__header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: .5rem;
        }
        .integration-card__header h3 { margin: 0; font-size: 1rem; line-height: 1.3; }
        .integration-card__id {
          margin: 0;
          font-size: var(--text-small, .875rem);
          opacity: .65;
          font-family: var(--font-mono, monospace);
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
