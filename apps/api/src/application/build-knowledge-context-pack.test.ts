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
});
