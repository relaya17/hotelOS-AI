import type { CompanyKnowledgeRepository } from "@hotelos/database";
import type { TenantId } from "@hotelos/shared";

const MAX_DOCS = 5;
const MAX_SNIPPET = 400;
const MAX_PACK = 4000;

/**
 * Keyword hits from approved company knowledge — authorized facts only.
 * Gateway never searches; API builds the pack (Vol. 5 / ADR 0008).
 */
export async function buildKnowledgeContextPack(
  companyKnowledge: CompanyKnowledgeRepository,
  tenantId: TenantId,
  message: string,
): Promise<string | undefined> {
  const terms = extractSearchTerms(message);
  if (terms.length === 0) return undefined;

  const byId = new Map<
    string,
    { readonly title: string; readonly body: string; readonly category: string }
  >();

  for (const term of terms) {
    const hits = await companyKnowledge.search(tenantId, term);
    for (const hit of hits) {
      if (!byId.has(hit.id)) {
        byId.set(hit.id, {
          title: hit.title,
          body: hit.body,
          category: hit.category,
        });
      }
      if (byId.size >= MAX_DOCS) break;
    }
    if (byId.size >= MAX_DOCS) break;
  }

  if (byId.size === 0) return undefined;

  const lines = [
    "Context pack — Company Knowledge (approved only)",
    "השתמש רק בעובדות להלן. אל תמציא מדיניות. ציטוט: Company Knowledge.",
  ];

  for (const doc of byId.values()) {
    const snippet =
      doc.body.length > MAX_SNIPPET
        ? `${doc.body.slice(0, MAX_SNIPPET)}…`
        : doc.body;
    lines.push(`• [${doc.category}] ${doc.title}: ${snippet}`);
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
    .filter((t) => t.length >= 3);

  const unique: string[] = [];
  for (const token of tokens) {
    if (!unique.includes(token)) unique.push(token);
    if (unique.length >= 6) break;
  }
  return unique;
}
