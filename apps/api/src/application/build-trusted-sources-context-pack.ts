import type { TrustedSourcesRepository } from "@hotelos/database";
import type { TenantId } from "@hotelos/shared";

const MAX_SOURCES = 6;
const MAX_PACK = 3000;

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

/**
 * Keyword hits from approved Trusted Sources allowlist — external facts only.
 * Gateway never searches the open web; API builds the pack (Vol. 5 / ADR 0007).
 */
export async function buildTrustedSourcesContextPack(
  trustedSources: TrustedSourcesRepository,
  tenantId: TenantId,
  message: string,
): Promise<string | undefined> {
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

  const lines = [
    "Context pack — Trusted Sources (approved allowlist only)",
    "הסתמך רק על מקורות אלה לעובדות חיצוניות. ציטוט: Trusted Source · כותרת · URL.",
    "אל תמציא נתונים ממקורות שאינם ברשימה.",
  ];

  for (const source of hits) {
    lines.push(
      `• [${source.category}] ${source.title} — ${source.url} (ציטוט: Trusted Source · ${source.title} · ${source.url})`,
    );
  }

  let pack = lines.join("\n");
  if (pack.length > MAX_PACK) {
    pack = `${pack.slice(0, MAX_PACK)}…`;
  }
  return pack;
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
    if (unique.length >= 8) break;
  }
  return unique;
}
