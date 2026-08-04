import type {
  TrustedSourceSnapshotsRepository,
  TrustedSourcesRepository,
} from "@hotelos/database";
import { DEMO_TENANT_ID } from "@hotelos/database";
import { Ids } from "@hotelos/shared";
import { ingestTrustedAllowlistFeeds } from "./ingest-trusted-market-feeds.js";

export type RunTrustedSourcesRefreshDeps = {
  readonly trustedSources: TrustedSourcesRepository;
  readonly snapshots: TrustedSourceSnapshotsRepository;
};

/**
 * Nightly allowlist page fetch → text snapshot for all Trusted Source categories.
 */
export async function runTrustedSourcesRefresh(
  deps: RunTrustedSourcesRefreshDeps,
) {
  const tenantId = Ids.tenant(DEMO_TENANT_ID);
  const result = await ingestTrustedAllowlistFeeds(deps, tenantId);
  return {
    tenantId,
    ...result,
  };
}
