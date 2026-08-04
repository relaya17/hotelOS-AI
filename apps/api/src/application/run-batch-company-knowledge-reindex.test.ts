import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CompanyKnowledgeRepository } from "@hotelos/database";
import { runBatchCompanyKnowledgeReindex } from "./run-batch-company-knowledge-reindex.js";

describe("runBatchCompanyKnowledgeReindex", () => {
  it("reindexes approved docs missing chunks or embeddings", async () => {
    let replaceCalls = 0;
    let upsertDoc = 0;
    let upsertChunks = 0;
    let storedChunks: {
      id: string;
      docId: string;
      tenantId: string;
      chunkIndex: number;
      text: string;
      contentHash: string;
      createdAt: string;
      embedding: null;
      embeddingModel: null;
      embeddedAt: null;
    }[] = [];

    const companyKnowledge = {
      list: async () => [
        {
          id: "stale",
          tenantId: "11111111-1111-4111-8111-111111111111",
          title: "ישן",
          body: "מדיניות ביטול לדוגמה.",
          category: "policy",
          status: "approved",
          createdByUserId: "u1",
          approvedByUserId: "u1",
          approvedAt: "2026-01-01T00:00:00.000Z",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      getById: async () => ({
        id: "stale",
        tenantId: "11111111-1111-4111-8111-111111111111",
        title: "ישן",
        body: "מדיניות ביטול לדוגמה.",
        category: "policy",
        status: "approved",
        createdByUserId: "u1",
        approvedByUserId: "u1",
        approvedAt: "2026-01-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
      listChunksForDocs: async () => storedChunks,
      getEmbedding: async () => null,
      replaceChunks: async (input: {
        readonly chunks: readonly {
          readonly id: string;
          readonly chunkIndex: number;
          readonly text: string;
          readonly contentHash: string;
        }[];
        readonly docId: string;
        readonly tenantId: string;
        readonly createdAt: string;
      }) => {
        replaceCalls += 1;
        storedChunks = input.chunks.map((chunk) => ({
          id: chunk.id,
          docId: input.docId,
          tenantId: input.tenantId,
          chunkIndex: chunk.chunkIndex,
          text: chunk.text,
          contentHash: chunk.contentHash,
          createdAt: input.createdAt,
          embedding: null,
          embeddingModel: null,
          embeddedAt: null,
        }));
      },
      upsertEmbedding: async () => {
        upsertDoc += 1;
      },
      upsertChunkEmbeddings: async () => {
        upsertChunks += 1;
      },
    } as unknown as CompanyKnowledgeRepository;

    const gateway = {
      embed: async (texts: readonly string[]) => ({
        model: "test",
        vectors: texts.map(() => [0.2, 0.3]),
      }),
    };

    const result = await runBatchCompanyKnowledgeReindex({
      companyKnowledge,
      gateway: gateway as never,
    });

    assert.equal(result.processed, 1);
    assert.equal(result.skippedFresh, 0);
    assert.ok(replaceCalls >= 1);
    assert.ok(upsertDoc >= 1);
    assert.ok(upsertChunks >= 1);
  });
});
