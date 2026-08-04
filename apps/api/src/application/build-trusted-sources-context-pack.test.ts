import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TrustedSourcesRepository } from "@hotelos/database";
import { Ids } from "@hotelos/shared";
import { buildTrustedSourcesContextPack } from "./build-trusted-sources-context-pack.js";

describe("buildTrustedSourcesContextPack", () => {
  it("returns undefined when no allowlisted sources match", async () => {
    const trustedSources = {
      list: async () => [
        {
          id: "s1",
          tenantId: "t1",
          title: "בנק ישראל",
          url: "https://www.boi.org.il",
          category: "regulator",
          approvedAt: "2026-01-01T00:00:00.000Z",
          approvedByUserId: "u1",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    } as unknown as TrustedSourcesRepository;

    const pack = await buildTrustedSourcesContextPack(
      trustedSources,
      Ids.tenant("00000000-0000-4000-8000-000000000001"),
      "מה מדיניות הביטולים בחדרים?",
    );
    assert.equal(pack, undefined);
  });

  it("formats matching Trusted Sources into an authorized pack", async () => {
    const trustedSources = {
      list: async () => [
        {
          id: "s1",
          tenantId: "t1",
          title: "בנק ישראל — נתוני מקרו",
          url: "https://www.boi.org.il",
          category: "regulator",
          approvedAt: "2026-01-01T00:00:00.000Z",
          approvedByUserId: "u1",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "s2",
          tenantId: "t1",
          title: "רשות המסים בישראל",
          url: "https://www.gov.il/he/departments/israel_tax_authority",
          category: "regulator",
          approvedAt: "2026-01-01T00:00:00.000Z",
          approvedByUserId: "u1",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    } as unknown as TrustedSourcesRepository;

    const pack = await buildTrustedSourcesContextPack(
      trustedSources,
      Ids.tenant("00000000-0000-4000-8000-000000000001"),
      "מה אומר בנק ישראל על נתוני מקרו וריבית?",
    );
    assert.ok(pack?.text);
    assert.match(pack.text, /Trusted Sources/);
    assert.match(pack.text, /בנק ישראל/);
    assert.match(pack.text, /boi\.org\.il/);
    // Stop-term "ישראל" ignored; "בנק"/"מקרו" rank the bank above tax authority.
    assert.equal(pack.text.includes("רשות המסים"), false);
    assert.equal(pack.citations.length, 1);
    assert.equal(pack.citations[0]?.source, "trusted");
  });

  it("prefers page snapshot text when available", async () => {
    const trustedSources = {
      list: async () => [
        {
          id: "s1",
          tenantId: "t1",
          title: "בנק ישראל — נתוני מקרו",
          url: "https://www.boi.org.il",
          category: "regulator",
          approvedAt: "2026-01-01T00:00:00.000Z",
          approvedByUserId: "u1",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    } as unknown as TrustedSourcesRepository;

    const snapshots = {
      listLatestOkForSources: async () => [
        {
          id: "snap1",
          tenantId: "t1",
          sourceId: "s1",
          fetchedAt: "2026-01-02T00:00:00.000Z",
          title: "בנק ישראל",
          summary: "ריבית בנק ישראל לעמוד זה היא 4.5 אחוזים.",
          checksum: "abc",
          status: "ok" as const,
          error: null,
          createdAt: "2026-01-02T00:00:00.000Z",
        },
      ],
    };

    const pack = await buildTrustedSourcesContextPack(
      trustedSources,
      Ids.tenant("00000000-0000-4000-8000-000000000001"),
      "מה אומר בנק ישראל על ריבית?",
      snapshots as never,
    );
    assert.ok(pack?.text);
    assert.match(pack.text, /Snapshot/);
    assert.match(pack.text, /4\.5/);
    assert.equal(pack.citations[0]?.snippet?.includes("4.5"), true);
  });

  it("fills pack from snapshot embeddings when keywords miss", async () => {
    const trustedSources = {
      list: async () => [
        {
          id: "s1",
          tenantId: "t1",
          title: "OECD Data Hub",
          url: "https://data.oecd.org",
          category: "market_data",
          approvedAt: "2026-01-01T00:00:00.000Z",
          approvedByUserId: "u1",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    } as unknown as TrustedSourcesRepository;

    const snapshots = {
      listLatestOkForSources: async () => [
        {
          id: "snap1",
          sourceId: "s1",
          summary: "Interest rates and macro dashboard excerpt.",
        },
      ],
      searchSourcesBySnapshotEmbedding: async () => [
        { sourceId: "s1", score: 0.82 },
      ],
    };

    const gateway = {
      embed: async () => ({
        model: "test-embed",
        vectors: [[0.1, 0.2, 0.3]],
      }),
    };

    const pack = await buildTrustedSourcesContextPack(
      trustedSources,
      Ids.tenant("00000000-0000-4000-8000-000000000001"),
      "מה הריבית העולמית כרגע?",
      snapshots as never,
      gateway as never,
    );
    assert.ok(pack?.text);
    assert.match(pack.text, /OECD/);
    assert.match(pack.text, /Snapshot/);
  });
});
