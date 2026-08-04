import type { AiCitation } from "@hotelos/ai-gateway";
import type {
  TrustedSourceSnapshotsRepository,
  TrustedSourcesRepository,
} from "@hotelos/database";
import type { TenantId } from "@hotelos/shared";

const MAX_SOURCES = 6;
const MAX_PACK = 3000;
const MAX_SNIPPET = 400;

/** Very common tokens that match too many Israeli allowlist titles. */
const STOP_TERMS = new Set([
  "ישראל",
  "israel",
  "www",
  "https",
  "http",
  "com",
  "org",
  "gov",
]);

export type TrustedSourcesContextPack = {
  readonly text: string;
  readonly citations: readonly AiCitation[];
};

/**
 * Keyword hits from approved Trusted Sources allowlist — external facts only.
 * Prefers stored page snapshots when present (fetch cron / CFO ingest).
 * Gateway never searches the open web; API builds the pack (Vol. 5 / ADR 0007).
 */
export async function buildTrustedSourcesContextPack(
  trustedSources: TrustedSourcesRepository,
  tenantId: TenantId,
  message: string,
  snapshots?: TrustedSourceSnapshotsRepository,
): Promise<TrustedSourcesContextPack | undefined> {
  const terms = extractSearchTerms(message);
  if (terms.length === 0) return undefined;

  const sources = await trustedSources.list(tenantId);
  if (sources.length === 0) return undefined;

  const scored = sources
    .map((source) => {
      const haystack =
        `${source.title} ${source.category} ${source.url}`.toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (haystack.includes(term)) score += 1;
      }
      return { source, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return undefined;

  const topScore = scored[0]?.score ?? 0;
  const hits = scored
    .filter((row) => row.score === topScore || row.score >= 2)
    .slice(0, MAX_SOURCES)
    .map((row) => row.source);

  const snapshotBySource = new Map<string, string>();
  if (snapshots !== undefined) {
    const latest = await snapshots.listLatestOkForSources(
      tenantId,
      hits.map((source) => source.id),
    );
    for (const snap of latest) {
      if (snap.summary.trim().length > 0) {
        snapshotBySource.set(snap.sourceId, snap.summary);
      }
    }
  }

  const lines = [
    "Context pack — Trusted Sources (approved allowlist only)",
    "הסתמך רק על מקורות אלה לעובדות חיצוניות. ציטוט: Trusted Source · כותרת · URL.",
    "אל תמציא נתונים ממקורות שאינם ברשימה.",
  ];
  const citations: AiCitation[] = [];

  for (const source of hits) {
    const snap = snapshotBySource.get(source.id);
    const snippet = snap
      ? snap.length > MAX_SNIPPET
        ? `${snap.slice(0, MAX_SNIPPET)}…`
        : snap
      : undefined;
    lines.push(
      snippet
        ? `• [${source.category}] ${source.title} — ${source.url}\n  Snapshot: ${snippet}`
        : `• [${source.category}] ${source.title} — ${source.url} (ציטוט: Trusted Source · ${source.title} · ${source.url})`,
    );
    citations.push({
      title: source.title,
      url: source.url,
      source: "trusted",
      ...(snippet ? { snippet: snippet.slice(0, 160) } : {}),
    });
  }

  let text = lines.join("\n");
  if (text.length > MAX_PACK) {
    text = `${text.slice(0, MAX_PACK)}…`;
  }
  return { text, citations };
}

function extractSearchTerms(message: string): readonly string[] {
  const tokens = message
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOP_TERMS.has(t));

  const unique: string[] = [];
  for (const token of tokens) {
    if (!unique.includes(token)) unique.push(token);
    if (unique.length >= 6) break;
  }
  return unique;
}
