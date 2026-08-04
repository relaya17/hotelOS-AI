import type { AiGateway } from "@hotelos/ai-gateway";
import type {
  CompanyKnowledgeRepository,
  PersistedCompanyKnowledgeDoc,
} from "@hotelos/database";
import type { TenantId } from "@hotelos/shared";
import { chunkCompanyKnowledgeDoc } from "./chunk-company-knowledge-doc.js";

const MAX_DOCS = 5;
const MAX_SNIPPET = 400;
const MAX_PACK = 4000;

/**
 * Hybrid keyword + embedding hits from approved company knowledge.
 * Prefers stored chunks for snippets; lazy-chunks docs that predate the table.
 * Gateway never searches; API builds the pack (Vol. 5 / ADR 0008).
 */
export async function buildKnowledgeContextPack(
  companyKnowledge: CompanyKnowledgeRepository,
  tenantId: TenantId,
  message: string,
  gateway?: AiGateway,
): Promise<string | undefined> {
  const terms = extractSearchTerms(message);
  const byId = new Map<string, PersistedCompanyKnowledgeDoc>();

  for (const term of terms) {
    const hits = await companyKnowledge.search(tenantId, term);
    for (const hit of hits) {
      if (!byId.has(hit.id)) {
        byId.set(hit.id, hit);
      }
      if (byId.size >= MAX_DOCS) break;
    }
    if (byId.size >= MAX_DOCS) break;
  }

  if (gateway !== undefined && byId.size < MAX_DOCS) {
    try {
      const embedded = await gateway.embed([message.slice(0, 2000)]);
      const queryVector = embedded.vectors[0];
      if (queryVector && queryVector.length > 0) {
        const semanticHits = await companyKnowledge.searchByEmbedding(
          tenantId,
          queryVector,
          MAX_DOCS,
        );
        for (const hit of semanticHits) {
          if (!byId.has(hit.id)) {
            byId.set(hit.id, hit);
          }
          if (byId.size >= MAX_DOCS) break;
        }
      }
    } catch {
      // Keyword pack remains valid when embeddings are unavailable.
    }
  }

  if (byId.size === 0) return undefined;

  let chunks = await companyKnowledge.listChunksForDocs(tenantId, [
    ...byId.keys(),
  ]);
  const present = new Set(chunks.map((chunk) => chunk.docId));
  for (const doc of byId.values()) {
    if (present.has(doc.id)) continue;
    try {
      await chunkCompanyKnowledgeDoc(companyKnowledge, {
        tenantId,
        docId: doc.id,
        title: doc.title,
        body: doc.body,
      });
    } catch {
      // Fall back to body prefix for this doc.
    }
  }
  if (present.size < byId.size) {
    chunks = await companyKnowledge.listChunksForDocs(tenantId, [
      ...byId.keys(),
    ]);
  }

  const chunksByDoc = new Map<string, string[]>();
  for (const chunk of chunks) {
    const list = chunksByDoc.get(chunk.docId) ?? [];
    list.push(chunk.text);
    chunksByDoc.set(chunk.docId, list);
  }

  const lines = [
    "Context pack — Company Knowledge (approved only)",
    "השתמש רק בעובדות להלן. אל תמציא מדיניות. ציטוט: Company Knowledge.",
  ];

  for (const doc of byId.values()) {
    const snippet = pickSnippet(doc.body, chunksByDoc.get(doc.id) ?? [], terms);
    lines.push(`• [${doc.category}] ${doc.title}: ${snippet}`);
  }

  let pack = lines.join("\n");
  if (pack.length > MAX_PACK) {
    pack = `${pack.slice(0, MAX_PACK)}…`;
  }
  return pack;
}

function pickSnippet(
  body: string,
  chunkTexts: readonly string[],
  terms: readonly string[],
): string {
  if (chunkTexts.length > 0) {
    let best = chunkTexts[0] ?? body;
    let bestScore = -1;
    for (const text of chunkTexts) {
      const lower = text.toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (lower.includes(term)) score += 1;
      }
      if (score > bestScore) {
        bestScore = score;
        best = text;
      }
    }
    return best.length > MAX_SNIPPET
      ? `${best.slice(0, MAX_SNIPPET)}…`
      : best;
  }
  return body.length > MAX_SNIPPET
    ? `${body.slice(0, MAX_SNIPPET)}…`
    : body;
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
