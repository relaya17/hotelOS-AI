import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CompanyKnowledgeRepository } from "@hotelos/database";
import { Ids } from "@hotelos/shared";
import { embedCompanyKnowledgeChunks } from "./embed-company-knowledge-chunks.js";

describe("embedCompanyKnowledgeChunks", () => {
  it("embeds pending chunks via the gateway and upserts vectors", async () => {
    const upserts: unknown[] = [];
    const companyKnowledge = {
      listChunksForDocs: async () => [
        {
          id: "c1",
          docId: "d1",
          tenantId: "t1",
          chunkIndex: 0,
          text: "chunk one",
          contentHash: "h1",
          createdAt: "2026-01-01T00:00:00.000Z",
          embedding: null,
          embeddingModel: null,
          embeddedAt: null,
        },
        {
          id: "c2",
          docId: "d1",
          tenantId: "t1",
          chunkIndex: 1,
          text: "chunk two",
          contentHash: "h2",
          createdAt: "2026-01-01T00:00:00.000Z",
          embedding: [0.1],
          embeddingModel: "already",
          embeddedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      upsertChunkEmbeddings: async (input: unknown) => {
        upserts.push(input);
      },
    } as unknown as CompanyKnowledgeRepository;

    const gateway = {
      embed: async (texts: readonly string[]) => {
        assert.deepEqual([...texts], ["chunk one"]);
        return { vectors: [[0.9, 0.1]], model: "test-embed" };
      },
    };

    const count = await embedCompanyKnowledgeChunks(
      { companyKnowledge, gateway: gateway as never },
      {
        tenantId: Ids.tenant("00000000-0000-4000-8000-000000000001"),
        docId: "d1",
      },
    );

    assert.equal(count, 2);
    assert.equal(upserts.length, 1);
  });

  it("returns already-embedded count when nothing is pending", async () => {
    const companyKnowledge = {
      listChunksForDocs: async () => [
        {
          id: "c1",
          docId: "d1",
          tenantId: "t1",
          chunkIndex: 0,
          text: "done",
          contentHash: "h1",
          createdAt: "2026-01-01T00:00:00.000Z",
          embedding: [1],
          embeddingModel: "m",
          embeddedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      upsertChunkEmbeddings: async () => {
        throw new Error("should not upsert");
      },
    } as unknown as CompanyKnowledgeRepository;

    const count = await embedCompanyKnowledgeChunks(
      {
        companyKnowledge,
        gateway: {
          embed: async () => {
            throw new Error("should not embed");
          },
        } as never,
      },
      {
        tenantId: Ids.tenant("00000000-0000-4000-8000-000000000001"),
        docId: "d1",
      },
    );
    assert.equal(count, 1);
  });
});
