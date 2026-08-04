import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  PersistedTrustedSource,
  PersistedTrustedSourceSnapshot,
  TrustedSourceSnapshotsRepository,
  TrustedSourcesRepository,
} from "@hotelos/database";
import { Ids } from "@hotelos/shared";
import {
  ingestTrustedMarketFeeds,
  summarizeFeedBody,
} from "./ingest-trusted-market-feeds.js";

test("summarizeFeedBody extracts title and text from HTML", () => {
  const summary = summarizeFeedBody(
    "<html><head><title>BOI Rates</title><meta name=\"description\" content=\"Macro update\"></head><body><p>Interest rate held</p></body></html>",
    "text/html",
  );
  assert.match(summary, /BOI Rates/);
  assert.match(summary, /Macro update|Interest rate/);
});

test("ingestTrustedMarketFeeds stores ok and failed snapshots", async () => {
  const tenantId = Ids.tenant("11111111-1111-4111-8111-111111111111");
  const sources: PersistedTrustedSource[] = [
    {
      id: "s-ok",
      tenantId,
      title: "OECD",
      url: "https://data.oecd.org",
      category: "market_data",
      approvedAt: "2026-08-03T00:00:00.000Z",
      approvedByUserId: null,
      createdAt: "2026-08-03T00:00:00.000Z",
    },
    {
      id: "s-fail",
      tenantId,
      title: "Broken",
      url: "https://example.invalid/fail",
      category: "market_data",
      approvedAt: "2026-08-03T00:00:00.000Z",
      approvedByUserId: null,
      createdAt: "2026-08-03T00:00:00.000Z",
    },
    {
      id: "s-skip",
      tenantId,
      title: "University",
      url: "https://example.com/uni",
      category: "university",
      approvedAt: "2026-08-03T00:00:00.000Z",
      approvedByUserId: null,
      createdAt: "2026-08-03T00:00:00.000Z",
    },
  ];
  const created: PersistedTrustedSourceSnapshot[] = [];

  const trustedSources = {
    list: async () => sources,
    create: async () => {
      throw new Error("unused");
    },
  } satisfies TrustedSourcesRepository;

  const snapshots = {
    create: async (input) => {
      const row: PersistedTrustedSourceSnapshot = {
        id: input.id,
        tenantId: input.tenantId,
        sourceId: input.sourceId,
        fetchedAt: input.fetchedAt,
        title: input.title,
        summary: input.summary,
        checksum: input.checksum,
        status: input.status,
        error: input.error ?? null,
        createdAt: input.createdAt,
        embedding: null,
        embeddingModel: null,
        embeddedAt: null,
      };
      created.push(row);
      return row;
    },
    listLatestByTenant: async () => created,
    listLatestOkForSources: async () =>
      created.filter((row) => row.status === "ok"),
    upsertEmbedding: async () => {
      // unused in this test
    },
    searchSourcesBySnapshotEmbedding: async () => [],
  } satisfies TrustedSourceSnapshotsRepository;

  const fetchImpl: typeof fetch = async (input) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url.includes("oecd")) {
      return new Response(
        "<html><head><title>OECD Data</title></head><body>GDP up</body></html>",
        { status: 200, headers: { "Content-Type": "text/html" } },
      );
    }
    return new Response("nope", { status: 503 });
  };

  const result = await ingestTrustedMarketFeeds(
    { trustedSources, snapshots, fetchImpl },
    tenantId,
  );

  assert.equal(result.attempted, 2);
  assert.equal(result.ok, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.embedded, 0);
  assert.equal(created.length, 2);
  assert.equal(created.find((row) => row.sourceId === "s-ok")?.status, "ok");
  assert.equal(
    created.find((row) => row.sourceId === "s-fail")?.status,
    "failed",
  );
});

test("ingestTrustedMarketFeeds embeds ok snapshots via gateway", async () => {
  const tenantId = Ids.tenant("11111111-1111-4111-8111-111111111111");
  const trustedSources = {
    list: async () => [
      {
        id: "s-ok",
        tenantId,
        title: "OECD",
        url: "https://data.oecd.org",
        category: "market_data",
        approvedAt: "2026-08-03T00:00:00.000Z",
        approvedByUserId: null,
        createdAt: "2026-08-03T00:00:00.000Z",
      },
    ],
    create: async () => {
      throw new Error("unused");
    },
  } satisfies TrustedSourcesRepository;

  let embedded = 0;
  const snapshots = {
    create: async (input) => ({
      id: input.id,
      tenantId: input.tenantId,
      sourceId: input.sourceId,
      fetchedAt: input.fetchedAt,
      title: input.title,
      summary: input.summary,
      checksum: input.checksum,
      status: input.status,
      error: input.error ?? null,
      createdAt: input.createdAt,
      embedding: null,
      embeddingModel: null,
      embeddedAt: null,
    }),
    listLatestByTenant: async () => [],
    listLatestOkForSources: async () => [],
    upsertEmbedding: async () => {
      embedded += 1;
    },
    searchSourcesBySnapshotEmbedding: async () => [],
  } satisfies TrustedSourceSnapshotsRepository;

  const fetchImpl: typeof fetch = async () =>
    new Response(
      "<html><head><title>OECD</title></head><body>Rates</body></html>",
      { status: 200, headers: { "Content-Type": "text/html" } },
    );

  const gateway = {
    embed: async () => ({
      model: "test-embed",
      vectors: [[0.2, 0.4, 0.6]],
    }),
  };

  const result = await ingestTrustedMarketFeeds(
    {
      trustedSources,
      snapshots,
      fetchImpl,
      gateway: gateway as never,
    },
    tenantId,
  );

  assert.equal(result.ok, 1);
  assert.equal(result.embedded, 1);
  assert.equal(embedded, 1);
});
