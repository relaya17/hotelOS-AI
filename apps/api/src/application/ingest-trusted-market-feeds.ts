import { createHash, randomUUID } from "node:crypto";
import type {
  TrustedSourceSnapshotsRepository,
  TrustedSourcesRepository,
} from "@hotelos/database";
import type { TenantId } from "@hotelos/shared";

/** Categories eligible for daily finance/economy refresh (allowlist only). */
export const FINANCE_FEED_CATEGORIES = new Set([
  "market_data",
  "regulator",
  "accounting_standard",
]);

const MAX_SUMMARY = 1200;
const FETCH_TIMEOUT_MS = 12_000;

export type IngestTrustedMarketFeedsDeps = {
  readonly trustedSources: TrustedSourcesRepository;
  readonly snapshots: TrustedSourceSnapshotsRepository;
  readonly fetchImpl?: typeof fetch;
};

export type IngestTrustedMarketFeedsResult = {
  readonly attempted: number;
  readonly ok: number;
  readonly failed: number;
  readonly snapshotIds: readonly string[];
};

/**
 * Fetch approved Trusted Sources (finance categories) and store text snapshots.
 * Legal/policy: allowlist URLs only — never open-web discovery as truth (ADR 0007).
 */
export async function ingestTrustedMarketFeeds(
  deps: IngestTrustedMarketFeedsDeps,
  tenantId: TenantId,
): Promise<IngestTrustedMarketFeedsResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const sources = (await deps.trustedSources.list(tenantId)).filter((source) =>
    FINANCE_FEED_CATEGORIES.has(source.category),
  );

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
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "User-Agent": "HotelOS-FinanceDoctor/1.0 (+trusted-source-refresh)",
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

export function summarizeFeedBody(
  raw: string,
  contentType: string,
): string {
  if (contentType.includes("application/json")) {
    try {
      const parsed: unknown = JSON.parse(raw);
      return JSON.stringify(parsed).slice(0, MAX_SUMMARY);
    } catch {
      return raw.replace(/\s+/g, " ").trim().slice(0, MAX_SUMMARY);
    }
  }

  const withoutScripts = raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(withoutScripts);
  const metaMatch =
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i.exec(
      withoutScripts,
    ) ??
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i.exec(
      withoutScripts,
    );
  const text = withoutScripts
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  const parts = [
    titleMatch?.[1]?.replace(/\s+/g, " ").trim(),
    metaMatch?.[1]?.replace(/\s+/g, " ").trim(),
    text,
  ].filter((part): part is string => Boolean(part && part.length > 0));

  return parts.join(" · ").slice(0, MAX_SUMMARY);
}
