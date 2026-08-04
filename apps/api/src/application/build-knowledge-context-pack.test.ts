import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CompanyKnowledgeRepository } from "@hotelos/database";
import { Ids } from "@hotelos/shared";
import { buildKnowledgeContextPack } from "./build-knowledge-context-pack.js";

describe("buildKnowledgeContextPack", () => {
  it("returns undefined when no approved docs match", async () => {
    const companyKnowledge = {
      search: async () => [],
      searchByEmbedding: async () => [],
      listChunksForDocs: async () => [],
    } as unknown as CompanyKnowledgeRepository;

    const pack = await buildKnowledgeContextPack(
      companyKnowledge,
      Ids.tenant("00000000-0000-4000-8000-000000000001"),
      "מה מדיניות הביטולים?",
    );
    assert.equal(pack, undefined);
  });

  it("formats approved keyword hits into an authorized pack", async () => {
    const companyKnowledge = {
      search: async (_tenantId: unknown, query: string) => {
        if (!query.includes("ביטול") && !query.includes("cancellation")) {
          return [];
        }
        return [
          {
            id: "doc-1",
            tenantId: "t1",
            title: "מדיניות ביטולים",
            body: "ביטול עד 48 שעות לפני הגעה ללא עלות.",
            category: "policy",
            status: "approved",
            createdByUserId: "u1",
            approvedByUserId: "u1",
            approvedAt: "2026-01-01T00:00:00.000Z",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ];
      },
      searchByEmbedding: async () => [],
      listChunksForDocs: async () => [],
    } as unknown as CompanyKnowledgeRepository;

    const pack = await buildKnowledgeContextPack(
      companyKnowledge,
      Ids.tenant("00000000-0000-4000-8000-000000000001"),
      "מה מדיניות הביטולים אצלנו?",
    );
    assert.ok(pack);
    assert.match(pack, /Company Knowledge/);
    assert.match(pack, /מדיניות ביטולים/);
    assert.match(pack, /48 שעות/);
  });

  it("merges semantic hits when keyword search finds nothing", async () => {
    const companyKnowledge = {
      search: async () => [],
      searchByEmbedding: async () => [
        {
          id: "doc-sem",
          tenantId: "t1",
          title: "נוהל קבלה",
          body: "אורח מזוהה עם תעודה בקבלה.",
          category: "sop",
          status: "approved",
          createdByUserId: "u1",
          approvedByUserId: "u1",
          approvedAt: "2026-01-01T00:00:00.000Z",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      listChunksForDocs: async () => [],
    } as unknown as CompanyKnowledgeRepository;

    const gateway = {
      embed: async () => ({
        vectors: [[0.1, 0.2, 0.3]],
        model: "test-embed",
      }),
    };

    const pack = await buildKnowledgeContextPack(
      companyKnowledge,
      Ids.tenant("00000000-0000-4000-8000-000000000001"),
      "איך מקבלים אורח חדש?",
      gateway as never,
    );
    assert.ok(pack);
    assert.match(pack, /נוהל קבלה/);
  });

  it("prefers a matching chunk snippet over the body prefix", async () => {
    const companyKnowledge = {
      search: async () => [
        {
          id: "doc-1",
          tenantId: "t1",
          title: "מדריך ארוך",
          body: `${"א".repeat(50)}\n\nביטול מאוחר כפוף לקנס מיוחד בסעיף זה.`,
          category: "policy",
          status: "approved",
          createdByUserId: "u1",
          approvedByUserId: "u1",
          approvedAt: "2026-01-01T00:00:00.000Z",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      searchByEmbedding: async () => [],
      listChunksForDocs: async () => [
        {
          id: "c1",
          docId: "doc-1",
          tenantId: "t1",
          chunkIndex: 0,
          text: "א".repeat(50),
          contentHash: "h0",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "c2",
          docId: "doc-1",
          tenantId: "t1",
          chunkIndex: 1,
          text: "ביטול מאוחר כפוף לקנס מיוחד בסעיף זה.",
          contentHash: "h1",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    } as unknown as CompanyKnowledgeRepository;

    const pack = await buildKnowledgeContextPack(
      companyKnowledge,
      Ids.tenant("00000000-0000-4000-8000-000000000001"),
      "מה קורה בביטול מאוחר?",
    );
    assert.ok(pack);
    assert.match(pack, /קנס מיוחד/);
  });

  it("lazy-chunks approved docs that have no stored chunks yet", async () => {
    let replaced = 0;
    const companyKnowledge = {
      search: async () => [
        {
          id: "doc-legacy",
          tenantId: "t1",
          title: "מדיניות ישנה",
          body: "ביטול עד 24 שעות לפני הגעה.",
          category: "policy",
          status: "approved",
          createdByUserId: "u1",
          approvedByUserId: "u1",
          approvedAt: "2026-01-01T00:00:00.000Z",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      searchByEmbedding: async () => [],
      listChunksForDocs: async () =>
        replaced === 0
          ? []
          : [
              {
                id: "c-new",
                docId: "doc-legacy",
                tenantId: "t1",
                chunkIndex: 0,
                text: "ביטול עד 24 שעות לפני הגעה.",
                contentHash: "new",
                createdAt: "2026-01-02T00:00:00.000Z",
              },
            ],
      replaceChunks: async () => {
        replaced += 1;
      },
    } as unknown as CompanyKnowledgeRepository;

    const pack = await buildKnowledgeContextPack(
      companyKnowledge,
      Ids.tenant("00000000-0000-4000-8000-000000000001"),
      "מה מדיניות הביטולים?",
    );
    assert.ok(pack);
    assert.equal(replaced, 1);
    assert.match(pack, /24 שעות/);
  });
});
