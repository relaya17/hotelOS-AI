import type { AiCitation, AiGateway } from "@hotelos/ai-gateway";
import {
  cosineSimilarity,
  type CompanyKnowledgeRepository,
  type PersistedCompanyKnowledgeChunk,
  type PersistedCompanyKnowledgeDoc,
} from "@hotelos/database";
import type { TenantId } from "@hotelos/shared";
import { chunkCompanyKnowledgeDoc } from "./chunk-company-knowledge-doc.js";
import { embedCompanyKnowledgeChunks } from "./embed-company-knowledge-chunks.js";

const MAX_DOCS = 5;
const MAX_SNIPPET = 400;
const MAX_PACK = 4000;

export type KnowledgeContextPack = {
  readonly text: string;
  readonly citations: readonly AiCitation[];
};

/**
 * Hybrid keyword + doc/chunk embedding hits from approved company knowledge.
 * Prefers stored chunks for snippets; lazy-chunks docs that predate the table.
 * Gateway never searches; API builds the pack (Vol. 5 / ADR 0008).
 */
export async function buildKnowledgeContextPack(
  companyKnowledge: CompanyKnowledgeRepository,
  tenantId: TenantId,
  message: string,
  gateway?: AiGateway,
): Promise<KnowledgeContextPack | undefined> {
  const terms = extractSearchTerms(message);
  const byId = new Map<string, PersistedCompanyKnowledgeDoc>();
  let queryVector: readonly number[] | undefined;

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
      queryVector = embedded.vectors[0];
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

        if (byId.size < MAX_DOCS) {
          const chunkHits = await companyKnowledge.searchChunksByEmbedding(
            tenantId,
            queryVector,
            MAX_DOCS,
          );
          for (const hit of chunkHits) {
            if (!byId.has(hit.doc.id)) {
              byId.set(hit.doc.id, hit.doc);
            }
            if (byId.size >= MAX_DOCS) break;
          }
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
      if (gateway !== undefined) {
        await embedCompanyKnowledgeChunks(
          { companyKnowledge, gateway },
          { tenantId, docId: doc.id },
        );
      }
    } catch {
      // Fall back to body prefix for this doc.
    }
  }
  if (present.size < byId.size) {
    chunks = await companyKnowledge.listChunksForDocs(tenantId, [
      ...byId.keys(),
    ]);
  }

  const chunksByDoc = new Map<string, PersistedCompanyKnowledgeChunk[]>();
  for (const chunk of chunks) {
    const list = chunksByDoc.get(chunk.docId) ?? [];
    list.push(chunk);
    chunksByDoc.set(chunk.docId, list);
  }

  const lines = [
    "Context pack — Company Knowledge (approved only)",
    "השתמש רק בעובדות להלן. אל תמציא מדיניות. ציטוט: Company Knowledge.",
  ];
  const citations: AiCitation[] = [];

  for (const doc of byId.values()) {
    const picked = pickSnippet(
      doc.body,
      chunksByDoc.get(doc.id) ?? [],
      terms,
      queryVector,
    );
    lines.push(`• [${doc.category}] ${doc.title}: ${picked.text}`);
    citations.push({
      title:
        picked.chunkIndex !== undefined
          ? `${doc.title} · קטע ${picked.chunkIndex + 1}`
          : doc.title,
      source: "company",
      ...(picked.snippetPreview
        ? { snippet: picked.snippetPreview }
        : {}),
    });
  }

  let text = lines.join("\n");
  if (text.length > MAX_PACK) {
    text = `${text.slice(0, MAX_PACK)}…`;
  }
  return { text, citations };
}

function pickSnippet(
  body: string,
  chunks: readonly PersistedCompanyKnowledgeChunk[],
  terms: readonly string[],
  queryVector?: readonly number[],
): {
  readonly text: string;
  readonly chunkIndex?: number;
  readonly snippetPreview?: string;
} {
  if (chunks.length > 0) {
    let best = chunks[0]!;
    let bestScore = -1;

    if (queryVector && queryVector.length > 0) {
      for (const chunk of chunks) {
        if (!chunk.embedding) continue;
        const score = cosineSimilarity(queryVector, chunk.embedding);
        if (score > bestScore) {
          bestScore = score;
          best = chunk;
        }
      }
    }

    if (bestScore < 0) {
      for (const chunk of chunks) {
        const lower = chunk.text.toLowerCase();
        let score = 0;
        for (const term of terms) {
          if (lower.includes(term)) score += 1;
        }
        if (score > bestScore) {
          bestScore = score;
          best = chunk;
        }
      }
    }

    const text =
      best.text.length > MAX_SNIPPET
        ? `${best.text.slice(0, MAX_SNIPPET)}…`
        : best.text;
    return {
      text,
      chunkIndex: best.chunkIndex,
      snippetPreview: best.text.slice(0, 160),
    };
  }

  const text =
    body.length > MAX_SNIPPET ? `${body.slice(0, MAX_SNIPPET)}…` : body;
  return { text, snippetPreview: body.slice(0, 160) };
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
