import type { AiGateway } from "@hotelos/ai-gateway";
import type { CompanyKnowledgeRepository } from "@hotelos/database";
import { DEMO_TENANT_ID } from "@hotelos/database";
import { Ids } from "@hotelos/shared";
import { reindexCompanyKnowledgeDoc } from "./reindex-company-knowledge-doc.js";

const BATCH_LIMIT = 20;

export type RunBatchCompanyKnowledgeReindexDeps = {
  readonly companyKnowledge: CompanyKnowledgeRepository;
  readonly gateway: AiGateway;
};

export type BatchCompanyKnowledgeReindexResult = {
  readonly tenantId: string;
  readonly scanned: number;
  readonly processed: number;
  readonly skippedFresh: number;
  readonly chunkTotal: number;
  readonly chunksEmbedded: number;
  readonly docsEmbedded: number;
};

/**
 * Nightly backfill: reindex approved company knowledge docs missing
 * chunks and/or embeddings (demo tenant MVP, same as CIO/CFO cron).
 */
export async function runBatchCompanyKnowledgeReindex(
  deps: RunBatchCompanyKnowledgeReindexDeps,
): Promise<BatchCompanyKnowledgeReindexResult> {
  const tenantId = Ids.tenant(DEMO_TENANT_ID);
  const docs = await deps.companyKnowledge.list(tenantId, "approved");

  let processed = 0;
  let skippedFresh = 0;
  let chunkTotal = 0;
  let chunksEmbedded = 0;
  let docsEmbedded = 0;

  for (const doc of docs) {
    if (processed >= BATCH_LIMIT) break;

    const existingChunks = await deps.companyKnowledge.listChunksForDocs(
      tenantId,
      [doc.id],
    );
    const docEmbedding = await deps.companyKnowledge.getEmbedding(
      tenantId,
      doc.id,
    );
    const needsWork =
      existingChunks.length === 0 ||
      existingChunks.some((chunk) => chunk.embedding === null) ||
      docEmbedding === null;

    if (!needsWork) {
      skippedFresh += 1;
      continue;
    }

    const result = await reindexCompanyKnowledgeDoc(deps, {
      tenantId,
      docId: doc.id,
    });
    if (!result) continue;

    processed += 1;
    chunkTotal += result.chunkCount;
    chunksEmbedded += result.chunksEmbedded;
    if (result.embedded) docsEmbedded += 1;
  }

  return {
    tenantId,
    scanned: docs.length,
    processed,
    skippedFresh,
    chunkTotal,
    chunksEmbedded,
    docsEmbedded,
  };
}
