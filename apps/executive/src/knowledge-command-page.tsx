import { useEffect, useMemo, useState } from "react";
import { Button, TextField } from "@hotelos/ui";
import {
  fetchCfoFinanceBrief,
  fetchCfoMarketSnapshots,
  fetchCioDigest,
  invokeAiGateway,
  listCompanyKnowledgeDocs,
  listPendingAiApprovals,
  listTrustedSources,
  refreshCfoMarketFeeds,
  searchCompanyKnowledgeDocs,
  type AiGatewayInvokeResultDto,
  type CfoFinanceBriefDto,
  type CioDigestDto,
  type CompanyKnowledgeDocDto,
  type TrustedSourceDto,
  type TrustedSourceSnapshotDto,
} from "@hotelos/web-client";

export type KnowledgeCommandPageProps = {
  readonly onOpenCio: () => void;
  readonly onOpenFinance: () => void;
  readonly onOpenApprovals: () => void;
};

function ageLabelHe(iso: string | undefined): string {
  if (!iso) return "אין דגימה";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return "לא ידוע";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return "עדכני (< שעה)";
  if (hours < 24) return `לפני ${hours} שע׳`;
  const days = Math.floor(hours / 24);
  return `לפני ${days} ימ׳`;
}

function freshnessTone(
  iso: string | undefined,
  status: "ok" | "failed" | undefined,
): "ok" | "warn" | "bad" | "mute" {
  if (!iso) return "mute";
  if (status === "failed") return "bad";
  const hours = (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60);
  if (Number.isNaN(hours)) return "mute";
  if (hours <= 24) return "ok";
  if (hours <= 72) return "warn";
  return "bad";
}

export function KnowledgeCommandPage({
  onOpenCio,
  onOpenFinance,
  onOpenApprovals,
}: KnowledgeCommandPageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();

  const [cio, setCio] = useState<CioDigestDto | null>(null);
  const [cfo, setCfo] = useState<CfoFinanceBriefDto | null>(null);
  const [docs, setDocs] = useState<readonly CompanyKnowledgeDocDto[]>([]);
  const [sources, setSources] = useState<readonly TrustedSourceDto[]>([]);
  const [snapshots, setSnapshots] = useState<readonly TrustedSourceSnapshotDto[]>(
    [],
  );
  const [pendingCount, setPendingCount] = useState(0);

  const [ask, setAsk] = useState("מה דורש תשומת לב מהנהלה היום?");
  const [askLoading, setAskLoading] = useState(false);
  const [askError, setAskError] = useState<string | undefined>();
  const [askResult, setAskResult] = useState<AiGatewayInvokeResultDto | null>(
    null,
  );

  const [query, setQuery] = useState("");
  const [searchHits, setSearchHits] = useState<
    readonly CompanyKnowledgeDocDto[] | null
  >(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const [refreshBusy, setRefreshBusy] = useState(false);

  async function reloadHub() {
    const [cioDigest, cfoBrief, companyDocs, trusted, snaps, pending] =
      await Promise.all([
        fetchCioDigest("ceo"),
        fetchCfoFinanceBrief(),
        listCompanyKnowledgeDocs("approved"),
        listTrustedSources(),
        fetchCfoMarketSnapshots(),
        listPendingAiApprovals(),
      ]);
    setCio(cioDigest);
    setCfo(cfoBrief);
    setDocs(companyDocs);
    setSources(trusted);
    setSnapshots(snaps);
    setPendingCount(pending.length);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(undefined);
      try {
        await reloadHub();
      } catch (loadError: unknown) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "טעינת פיקוד ידע נכשלה",
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

  const latestBySource = useMemo(() => {
    const map = new Map<string, TrustedSourceSnapshotDto>();
    for (const snap of snapshots) {
      const prev = map.get(snap.sourceId);
      if (!prev || snap.fetchedAt > prev.fetchedAt) {
        map.set(snap.sourceId, snap);
      }
    }
    return map;
  }, [snapshots]);

  const freshnessStats = useMemo(() => {
    let ok = 0;
    let stale = 0;
    let failed = 0;
    let bare = 0;
    for (const source of sources) {
      const snap = latestBySource.get(source.id);
      const tone = freshnessTone(snap?.fetchedAt, snap?.status);
      if (tone === "ok") ok += 1;
      else if (tone === "warn" || tone === "bad") {
        if (snap?.status === "failed") failed += 1;
        else stale += 1;
      } else bare += 1;
    }
    return { ok, stale, failed, bare };
  }, [sources, latestBySource]);

  async function onAsk() {
    if (ask.trim().length === 0) return;
    setAskLoading(true);
    setAskError(undefined);
    try {
      const contextPack = [
        cio?.headlineHe,
        ...(cio?.sections.flatMap((s) => s.bulletsHe) ?? []),
        cfo?.headlineHe,
        ...(cfo?.anomalyBulletsHe ?? []),
        ...(cfo?.marketSnapshotsHe ?? []).slice(0, 4),
      ]
        .filter((line): line is string => Boolean(line && line.trim()))
        .join("\n");
      const result = await invokeAiGateway({
        agentId: "agent.cio",
        message: ask.trim(),
        locale: "he",
        ...(contextPack.length > 0 ? { contextPack } : {}),
      });
      setAskResult(result);
    } catch (invokeError: unknown) {
      setAskError(
        invokeError instanceof Error ? invokeError.message : "שגיאת Gateway",
      );
    } finally {
      setAskLoading(false);
    }
  }

  async function onSearch() {
    const q = query.trim();
    if (q.length === 0) {
      setSearchHits(null);
      return;
    }
    setSearchBusy(true);
    setError(undefined);
    try {
      setSearchHits(await searchCompanyKnowledgeDocs(q));
    } catch (searchError: unknown) {
      setError(
        searchError instanceof Error ? searchError.message : "חיפוש נכשל",
      );
    } finally {
      setSearchBusy(false);
    }
  }

  async function onRefreshFeeds() {
    setRefreshBusy(true);
    setNotice(undefined);
    setError(undefined);
    try {
      const result = await refreshCfoMarketFeeds();
      await reloadHub();
      setNotice(
        `רענון מקורות: ${result.ok}/${result.attempted} הצליחו` +
          (result.failed > 0 ? ` · ${result.failed} נכשלו` : ""),
      );
    } catch (refreshError: unknown) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "רענון מקורות נכשל",
      );
    } finally {
      setRefreshBusy(false);
    }
  }

  return (
    <div className="kc">
      <header className="kc__header">
        <div>
          <p className="hotelos-eyebrow">HQ · Knowledge Command</p>
          <h1>פיקוד ידע</h1>
          <p className="sub">
            מרכז פיקוד להנהלה: ידע ארגוני מאושר, מקורות אמינים, תדריכים חיים
            ואישורים ממתינים — בלי החלפת מערכת ההפעלה של המלון.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          disabled={loading || refreshBusy}
          onClick={() => {
            void (async () => {
              setLoading(true);
              setError(undefined);
              try {
                await reloadHub();
              } catch (reloadError: unknown) {
                setError(
                  reloadError instanceof Error
                    ? reloadError.message
                    : "רענון נכשל",
                );
              } finally {
                setLoading(false);
              }
            })();
          }}
        >
          רענן לוח
        </Button>
      </header>

      {error ? (
        <p className="state state--err" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="state state--ok" role="status">
          {notice}
        </p>
      ) : null}
      {loading ? <p className="hint">טוען פיקוד…</p> : null}

      <section className="kc__hub" aria-label="מצב ידע">
        <article className="kc-hub">
          <p className="kc-hub__label">ידע ארגוני</p>
          <p className="kc-hub__value">{docs.length}</p>
          <p className="kc-hub__meta">מסמכים מאושרים</p>
        </article>
        <article className="kc-hub">
          <p className="kc-hub__label">מקורות אמינים</p>
          <p className="kc-hub__value">{sources.length}</p>
          <p className="kc-hub__meta">
            {freshnessStats.ok} עדכניים · {freshnessStats.stale + freshnessStats.failed} דורשים תשומת לב
          </p>
        </article>
        <article className="kc-hub">
          <p className="kc-hub__label">דגימות שוק</p>
          <p className="kc-hub__value">{snapshots.length}</p>
          <p className="kc-hub__meta">
            {snapshots[0] ? ageLabelHe(snapshots[0]?.fetchedAt) : "אין דגימות"}
          </p>
        </article>
        <button type="button" className="kc-hub kc-hub--action" onClick={onOpenApprovals}>
          <p className="kc-hub__label">אישורי AI</p>
          <p className="kc-hub__value">{pendingCount}</p>
          <p className="kc-hub__meta">ממתינים · פתח תור</p>
        </button>
      </section>

      <section className="card kc__ask" aria-label="שאל את פיקוד הידע">
        <h2>שאל את הפיקוד</h2>
        <p className="hint">
          agent.cio עם חבילת הקשר מתדריכי CIO/כספים + ידע ארגוני ומקורות אמינים
          בשרת. אין ביצוע כספי אוטונומי.
        </p>
        <div className="compose">
          <TextField
            label="שאלה להנהלה"
            value={ask}
            onChange={(event) => setAsk(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void onAsk();
              }
            }}
          />
          <Button type="button" disabled={askLoading} onClick={() => void onAsk()}>
            {askLoading ? "חושב…" : "שאל"}
          </Button>
        </div>
        {askError ? (
          <p className="state state--err" role="alert">
            {askError}
          </p>
        ) : null}
        {askResult ? (
          <div className="kc-answer">
            <p className="narrative">{askResult.answerHe}</p>
            {askResult.citations.length > 0 ? (
              <ul className="kc-cites" aria-label="ציטוטים">
                {askResult.citations.map((cite) => (
                  <li key={`${cite.source}-${cite.title}-${cite.url ?? ""}`}>
                    <span className={`kc-chip kc-chip--${cite.source}`}>
                      {cite.source === "company"
                        ? "ארגון"
                        : cite.source === "trusted"
                          ? "אמין"
                          : "פנימי"}
                    </span>
                    {cite.url ? (
                      <a href={cite.url} target="_blank" rel="noreferrer">
                        {cite.title}
                      </a>
                    ) : (
                      <span>{cite.title}</span>
                    )}
                    {cite.snippet ? (
                      <span className="kc-cite-snippet"> — {cite.snippet}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="hint">
              {askResult.provider} · {askResult.confidence} · {askResult.latencyMs}
              ms
              {askResult.requiresHumanApproval
                ? ` · דורש אישור אדם${askResult.approvalReasonHe ? `: ${askResult.approvalReasonHe}` : ""}`
                : ""}
            </p>
          </div>
        ) : null}
      </section>

      <section className="kc__digests" aria-label="תדריכים חיים">
        <article className="card">
          <div className="kc-card-head">
            <h2>תדריך CIO</h2>
            <Button type="button" variant="ghost" onClick={onOpenCio}>
              פתח יועץ־על
            </Button>
          </div>
          {cio ? (
            <>
              <p className="kc-headline">{cio.headlineHe}</p>
              <p className="hint">
                {cio.roleLabelHe} · {ageLabelHe(cio.generatedAt)} · {cio.tenantName}
              </p>
              <ul className="kc-bullets">
                {cio.sections
                  .flatMap((section) => section.bulletsHe)
                  .slice(0, 4)
                  .map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
              </ul>
            </>
          ) : (
            <p className="hint">אין תדריך עדיין.</p>
          )}
        </article>

        <article className="card">
          <div className="kc-card-head">
            <h2>תדריך כספים</h2>
            <Button type="button" variant="ghost" onClick={onOpenFinance}>
              פתח סוכן כספים
            </Button>
          </div>
          {cfo ? (
            <>
              <p className="kc-headline">{cfo.headlineHe}</p>
              <p className="hint">
                {cfo.tenantName} · {ageLabelHe(cfo.generatedAt)}
              </p>
              <ul className="kc-bullets">
                {[
                  ...cfo.anomalyBulletsHe,
                  ...cfo.ledgerSummaryHe,
                  ...cfo.procurementBulletsHe,
                ]
                  .slice(0, 4)
                  .map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
              </ul>
            </>
          ) : (
            <p className="hint">אין תדריך כספים עדיין.</p>
          )}
        </article>
      </section>

      <section className="card" aria-label="חיפוש ידע ארגוני">
        <h2>חיפוש בידע ארגוני</h2>
        <p className="hint">
          חיפוש במסמכים מאושרים בלבד. יצירה ואישור נשארים ב־ops (Facilities).
        </p>
        <div className="compose">
          <TextField
            label="מילות חיפוש"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void onSearch();
              }
            }}
          />
          <Button
            type="button"
            disabled={searchBusy}
            onClick={() => void onSearch()}
          >
            {searchBusy ? "מחפש…" : "חפש"}
          </Button>
        </div>
        {searchHits ? (
          searchHits.length === 0 ? (
            <p className="hint">לא נמצאו מסמכים תואמים.</p>
          ) : (
            <ul className="kc-docs">
              {searchHits.map((doc) => (
                <li key={doc.id}>
                  <strong>{doc.title}</strong>
                  <span className="kc-chip kc-chip--company">{doc.category}</span>
                  <p>{doc.body.slice(0, 220)}{doc.body.length > 220 ? "…" : ""}</p>
                </li>
              ))}
            </ul>
          )
        ) : docs.length > 0 ? (
          <ul className="kc-docs kc-docs--preview">
            {docs.slice(0, 5).map((doc) => (
              <li key={doc.id}>
                <strong>{doc.title}</strong>
                <span className="kc-chip kc-chip--company">{doc.category}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">אין עדיין מסמכי ידע מאושרים.</p>
        )}
      </section>

      <section className="card" aria-label="טריות מקורות">
        <div className="kc-card-head">
          <h2>טריות מקורות אמינים</h2>
          <Button
            type="button"
            disabled={refreshBusy || sources.length === 0}
            onClick={() => void onRefreshFeeds()}
          >
            {refreshBusy ? "מרענן…" : "רענן פידים"}
          </Button>
        </div>
        <p className="hint">
          מקורות מ־allowlist + דגימות אחרונות מ־Finance Doctor. ניהול allowlist
          מלא ביועץ־על.
        </p>
        {sources.length === 0 ? (
          <p className="hint">אין מקורות אמינים ברשימה.</p>
        ) : (
          <ul className="kc-sources">
            {sources.map((source) => {
              const snap = latestBySource.get(source.id);
              const tone = freshnessTone(snap?.fetchedAt, snap?.status);
              return (
                <li key={source.id} className={`kc-source kc-source--${tone}`}>
                  <div>
                    <strong>{source.title}</strong>
                    <span className="hint">{source.category}</span>
                  </div>
                  <div className="kc-source__status">
                    <span className={`kc-dot kc-dot--${tone}`} aria-hidden />
                    <span>
                      {snap?.status === "failed"
                        ? `כשל · ${ageLabelHe(snap.fetchedAt)}`
                        : ageLabelHe(snap?.fetchedAt)}
                    </span>
                  </div>
                  {source.url ? (
                    <a href={source.url} target="_blank" rel="noreferrer">
                      פתח מקור
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <style>{`
        .kc { display:grid; gap:var(--space-5); animation:hotelos-enter var(--motion-med) var(--ease-out) both; }
        .kc__header { display:flex; justify-content:space-between; gap:var(--space-4); align-items:start; }
        .kc__header .hotelos-eyebrow { margin-bottom:var(--space-2); }
        .kc .sub { max-width:62ch; opacity:0.85; }
        .kc .hint { opacity:0.75; font-size:0.92rem; }
        .kc .card { display:grid; gap:var(--space-3); padding:var(--space-5); border:1px solid color-mix(in oklab, var(--border) 80%, transparent); border-radius:var(--radius-3, 12px); background:color-mix(in oklab, var(--surface, #fff) 92%, transparent); }
        .kc__hub { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:var(--space-3); }
        .kc-hub { display:grid; gap:var(--space-1); padding:var(--space-4); border-radius:var(--radius-3, 12px); border:1px solid color-mix(in oklab, var(--border) 70%, transparent); background:linear-gradient(160deg, color-mix(in oklab, var(--accent, #1f4b3a) 8%, transparent), transparent 70%); text-align:start; }
        .kc-hub--action { cursor:pointer; font:inherit; color:inherit; }
        .kc-hub--action:hover { border-color:color-mix(in oklab, var(--accent, #1f4b3a) 45%, var(--border)); }
        .kc-hub__label { margin:0; font-size:0.85rem; opacity:0.75; }
        .kc-hub__value { margin:0; font-size:2rem; font-weight:700; line-height:1.1; }
        .kc-hub__meta { margin:0; font-size:0.85rem; opacity:0.8; }
        .kc .compose { display:flex; gap:var(--space-3); align-items:end; flex-wrap:wrap; }
        .kc .compose > :first-child { flex:1 1 16rem; }
        .kc-answer { display:grid; gap:var(--space-3); }
        .kc-answer .narrative { margin:0; white-space:pre-wrap; line-height:1.55; }
        .kc-cites { list-style:none; margin:0; padding:0; display:grid; gap:var(--space-2); }
        .kc-cites li { display:flex; gap:var(--space-2); align-items:center; flex-wrap:wrap; }
        .kc-chip { display:inline-flex; align-items:center; padding:0.1rem 0.45rem; border-radius:999px; font-size:0.75rem; border:1px solid color-mix(in oklab, var(--border) 80%, transparent); }
        .kc-chip--company { background:color-mix(in oklab, #2f6f4e 18%, transparent); }
        .kc-chip--trusted { background:color-mix(in oklab, #3a5f8a 18%, transparent); }
        .kc-chip--internal { background:color-mix(in oklab, #6a5a3a 18%, transparent); }
        .kc__digests { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:var(--space-4); }
        .kc-card-head { display:flex; justify-content:space-between; gap:var(--space-3); align-items:center; }
        .kc-card-head h2 { margin:0; }
        .kc-headline { margin:0; font-size:1.1rem; font-weight:600; line-height:1.4; }
        .kc-bullets { margin:0; padding-inline-start:1.2rem; display:grid; gap:0.35rem; }
        .kc-docs { list-style:none; margin:0; padding:0; display:grid; gap:var(--space-3); }
        .kc-docs li { display:grid; gap:0.35rem; }
        .kc-docs--preview li { display:flex; gap:var(--space-2); align-items:center; flex-wrap:wrap; }
        .kc-sources { list-style:none; margin:0; padding:0; display:grid; gap:var(--space-2); }
        .kc-source { display:grid; grid-template-columns:1fr auto auto; gap:var(--space-3); align-items:center; padding:var(--space-3); border-radius:var(--radius-2, 8px); border:1px solid color-mix(in oklab, var(--border) 70%, transparent); }
        .kc-source > div:first-child { display:grid; gap:0.15rem; }
        .kc-source__status { display:flex; gap:0.4rem; align-items:center; white-space:nowrap; font-size:0.9rem; }
        .kc-dot { width:0.55rem; height:0.55rem; border-radius:50%; background:#888; }
        .kc-dot--ok, .kc-source--ok .kc-dot { background:#2f8f5b; }
        .kc-dot--warn, .kc-source--warn .kc-dot { background:#c4902f; }
        .kc-dot--bad, .kc-source--bad .kc-dot { background:#b44; }
        .kc-dot--mute { background:#888; }
        .state--err { color:#b44; }
        .state--ok { color:#2f8f5b; }
        @media (max-width: 960px) {
          .kc__hub { grid-template-columns:repeat(2, minmax(0,1fr)); }
          .kc__digests { grid-template-columns:1fr; }
          .kc-source { grid-template-columns:1fr; }
        }
        @media (max-width: 560px) {
          .kc__header { flex-direction:column; }
          .kc__hub { grid-template-columns:1fr; }
        }
      `}</style>
    </div>
  );
}
