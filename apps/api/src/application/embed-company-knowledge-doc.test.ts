import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CompanyKnowledgeRepository } from "@hotelos/database";
import { Ids } from "@hotelos/shared";
import {
  companyKnowledgeContentHash,
  embedCompanyKnowledgeDoc,
} from "./embed-company-knowledge-doc.js";

describe("embedCompanyKnowledgeDoc", () => {
  it("stores an embedding for an approved doc", async () => {
    const stored: unknown[] = [];
    const companyKnowledge = {
      getEmbedding: async () => null,
      upsertEmbedding: async (input: unknown) => {
        stored.push(input);
      },
    } as unknown as CompanyKnowledgeRepository;

    const gateway = {
      embed: async () => ({
        vectors: [[0.25, 0.5, 0.75]],
        model: "hotelos.deterministic.embed.v1",
      }),
    };

    const doc = {
      id: "doc-1",
      tenantId: "t1",
      title: "נוהל קבלה",
      body: "זיהוי אורח בתעודה",
      category: "sop",
      status: "approved",
      createdByUserId: "u1",
      approvedByUserId: "u1",
      approvedAt: "2026-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    };

    const ok = await embedCompanyKnowledgeDoc(
      { companyKnowledge, gateway: gateway as never },
      {
        tenantId: Ids.tenant("00000000-0000-4000-8000-000000000001"),
        doc,
      },
    );
    assert.equal(ok, true);
    assert.equal(stored.length, 1);
    const row = stored[0] as {
      contentHash: string;
      embedding: number[];
      model: string;
    };
    assert.equal(
      row.contentHash,
      companyKnowledgeContentHash(doc.title, doc.body),
    );
    assert.deepEqual(row.embedding, [0.25, 0.5, 0.75]);
    assert.equal(row.model, "hotelos.deterministic.embed.v1");
  });

  it("skips re-embed when content hash matches", async () => {
    let upsertCalls = 0;
    const doc = {
      id: "doc-1",
      tenantId: "t1",
      title: "נוהל",
      body: "גוף",
      category: "sop",
      status: "approved",
      createdByUserId: "u1",
      approvedByUserId: "u1",
      approvedAt: "2026-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const companyKnowledge = {
      getEmbedding: async () => ({
        contentHash: companyKnowledgeContentHash(doc.title, doc.body),
      }),
      upsertEmbedding: async () => {
        upsertCalls += 1;
      },
    } as unknown as CompanyKnowledgeRepository;

    const ok = await embedCompanyKnowledgeDoc(
      {
        companyKnowledge,
        gateway: { embed: async () => ({ vectors: [[1]], model: "x" }) } as never,
      },
      {
        tenantId: Ids.tenant("00000000-0000-4000-8000-000000000001"),
        doc,
      },
    );
    assert.equal(ok, true);
    assert.equal(upsertCalls, 0);
  });
});
