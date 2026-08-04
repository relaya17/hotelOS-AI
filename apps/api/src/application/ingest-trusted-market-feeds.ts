import { createHash, randomUUID } from "node:crypto";
import type {
  TrustedSourceSnapshotsRepository,
  TrustedSourcesRepository,
} from "@hotelos/database";
import type { TenantId } from "@hotelos/shared";
import { summarizeFeedBody } from "./summarize-trusted-feed-body.js";

export { summarizeFeedBody } from "./summarize-trusted-feed-body.js";

/** Categories eligible for daily finance/economy refresh (allowlist only). */
export const FINANCE_FEED_CATEGORIES = new Set([
  "market_data",
  "regulator",
  "accounting_standard",
]);

const FETCH_TIMEOUT_MS = 12_000;

export type IngestTrustedFeedsDeps = {
  readonly trustedSources: TrustedSourcesRepository;
  readonly snapshots: TrustedSourceSnapshotsRepository;
  readonly fetchImpl?: typeof fetch;
};

/** @deprecated Use IngestTrustedFeedsDeps */
export type IngestTrustedMarketFeedsDeps = IngestTrustedFeedsDeps;

export type IngestTrustedFeedsResult = {
  readonly attempted: number;
  readonly ok: number;
  readonly failed: number;
  readonly snapshotIds: readonly string[];
};

/** @deprecated Use IngestTrustedFeedsResult */
export type IngestTrustedMarketFeedsResult = IngestTrustedFeedsResult;

/**
 * Fetch approved Trusted Sources and store text snapshots.
 * Allowlist URLs only — never open-web discovery as truth (ADR 0007).
 */
export async function ingestTrustedAllowlistFeeds(
  deps: IngestTrustedFeedsDeps,
  tenantId: TenantId,
  options?: { readonly categories?: ReadonlySet<string> },
): Promise<IngestTrustedFeedsResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const all = await deps.trustedSources.list(tenantId);
  const sources =
    options?.categories !== undefined
      ? all.filter((source) => options.categories!.has(source.category))
      : all;

  const snapshotIds: string[] = [];
  let ok = 0;
  let failed = 0;
  const now = new Date().toISOString();

  for (const source of sources) {
    const id = randomUUID();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const response = await fetchImpl(source.url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "User-Agent": "HotelOS-TrustedSources/1.0 (+allowlist-refresh)",
        },
      });
      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get("content-type") ?? "";
      const raw = await response.text();
      const summary = summarizeFeedBody(raw, contentType);
      const checksum = createHash("sha256").update(summary).digest("hex");

      await deps.snapshots.create({
        id,
        tenantId,
        sourceId: source.id,
        fetchedAt: now,
        title: source.title,
        summary,
        checksum,
        status: "ok",
        error: null,
        createdAt: now,
      });
      snapshotIds.push(id);
      ok += 1;
    } catch (error) {
      const message =
        error instanceof Error ? error.message.slice(0, 240) : "fetch failed";
      await deps.snapshots.create({
        id,
        tenantId,
        sourceId: source.id,
        fetchedAt: now,
        title: source.title,
        summary: "",
        checksum: createHash("sha256").update(message).digest("hex"),
        status: "failed",
        error: message,
        createdAt: now,
      });
      snapshotIds.push(id);
      failed += 1;
    }
  }

  return {
    attempted: sources.length,
    ok,
    failed,
    snapshotIds,
  };
}

/** Finance-category subset used by CFO daily brief. */
export async function ingestTrustedMarketFeeds(
  deps: IngestTrustedFeedsDeps,
  tenantId: TenantId,
): Promise<IngestTrustedFeedsResult> {
  return ingestTrustedAllowlistFeeds(deps, tenantId, {
    categories: FINANCE_FEED_CATEGORIES,
  });
}
