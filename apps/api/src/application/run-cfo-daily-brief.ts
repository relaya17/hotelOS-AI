import type { AiGateway } from "@hotelos/ai-gateway";
import type {
  CompanyKnowledgeRepository,
  HotelRepository,
  OrgCommsRepository,
} from "@hotelos/database";
import { DEMO_CHAIN_ID, DEMO_TENANT_ID } from "@hotelos/database";
import { Ids } from "@hotelos/shared";
import { randomUUID } from "node:crypto";
import {
  buildCfoFinanceBrief,
  type CfoFinanceBriefDeps,
} from "./build-cfo-finance-brief.js";
import {
  ingestTrustedMarketFeeds,
  type IngestTrustedMarketFeedsDeps,
} from "./ingest-trusted-market-feeds.js";
import { synthesizeCfoFinanceBrief } from "./synthesize-cfo-finance-brief.js";

const CRON_CFO_ACTOR_USER_ID = Ids.user(
  "00000000-0000-4000-8000-0000000000c2",
);

export type RunCfoDailyBriefDeps = CfoFinanceBriefDeps &
  IngestTrustedMarketFeedsDeps & {
    readonly hotels: HotelRepository;
    readonly orgComms: OrgCommsRepository;
    readonly gateway?: AiGateway;
    readonly companyKnowledge?: CompanyKnowledgeRepository;
  };

export type CfoDailyBriefResult = {
  readonly tenantId: string;
  readonly channelId: string;
  readonly messageId: string;
  readonly headlineHe: string;
  readonly narrativeIncluded: boolean;
  readonly provider: string | null;
  readonly ingest: {
    readonly attempted: number;
    readonly ok: number;
    readonly failed: number;
    readonly embedded: number;
  };
};

/**
 * Daily finance doctor: refresh Trusted market snapshots → brief → optional
 * agent.cfo narrative → Org Comms `cfo_daily`.
 */
export async function runCfoDailyBrief(
  deps: RunCfoDailyBriefDeps,
): Promise<CfoDailyBriefResult | null> {
  const tenantId = Ids.tenant(DEMO_TENANT_ID);
  const hotelRows = await deps.hotels.listByTenant(tenantId);
  if (hotelRows.length === 0) return null;

  const hotelIds = hotelRows.map((hotel) => hotel.id);
  const now = new Date().toISOString();

  const ingest = await ingestTrustedMarketFeeds(deps, tenantId);

  let body: string;
  let headlineHe: string;
  let narrativeIncluded = false;
  let provider: string | null = null;

  if (deps.gateway && deps.companyKnowledge) {
    const synthesized = await synthesizeCfoFinanceBrief(
      {
        overview: deps.overview,
        hotels: deps.hotels,
        turbo: deps.turbo,
        procurement: deps.procurement,
        trustedSources: deps.trustedSources,
        snapshots: deps.snapshots,
        maintenance: deps.maintenance,
        gateway: deps.gateway,
        companyKnowledge: deps.companyKnowledge,
      },
      {
        tenantId,
        userId: CRON_CFO_ACTOR_USER_ID,
        hotelIds,
        audience: "ceo",
        focus: "all",
      },
    );
    if (!synthesized) return null;
    headlineHe = synthesized.brief.headlineHe;
    narrativeIncluded = true;
    provider = synthesized.provider;
    body = formatSmartCfoMessage(synthesized, ingest);
  } else {
    const brief = await buildCfoFinanceBrief(deps, tenantId, hotelIds);
    if (!brief) return null;
    headlineHe = brief.headlineHe;
    body = formatFactsCfoMessage(brief, ingest);
  }

  const chainId = Ids.chain(hotelRows[0]?.chainId ?? DEMO_CHAIN_ID);
  const channel = await deps.orgComms.ensureChannel({
    id: randomUUID(),
    tenantId,
    chainId,
    channelKey: "cfo_daily",
    nameHe: "תדריך כספים יומי · Finance Doctor",
    createdAt: now,
  });

  const message = await deps.orgComms.addMessage({
    id: randomUUID(),
    tenantId,
    channelId: channel.id,
    fromRole: "agent.cfo",
    body,
    createdAt: now,
  });
  if (!message) return null;

  return {
    tenantId: String(tenantId),
    channelId: channel.id,
    messageId: message.id,
    headlineHe,
    narrativeIncluded,
    provider,
    ingest: {
      attempted: ingest.attempted,
      ok: ingest.ok,
      failed: ingest.failed,
      embedded: ingest.embedded,
    },
  };
}

function formatFactsCfoMessage(
  brief: {
    readonly roleLabelHe?: string;
    readonly headlineHe: string;
    readonly generatedAt: string;
    readonly hotelBulletsHe: readonly string[];
    readonly ledgerSummaryHe: readonly string[];
    readonly procurementBulletsHe: readonly string[];
    readonly marketingBulletsHe: readonly string[];
    readonly guestMemoryBulletsHe: readonly string[];
    readonly anomalyBulletsHe: readonly string[];
    readonly marketSnapshotsHe: readonly string[];
    readonly guardrailHe: string;
  },
  ingest: { readonly attempted: number; readonly ok: number; readonly failed: number },
): string {
  const lines = [
    "תדריך יומי · יועץ הנהלה · ניהול·קניין·שיווק·אורחים",
    brief.headlineHe,
    `נוצר: ${brief.generatedAt}`,
    `רענון Trusted: ${ingest.ok}/${ingest.attempted} הצליחו · ${ingest.failed} נכשלו`,
    "",
    "## מלונות",
    ...brief.hotelBulletsHe.map((line) => `• ${line}`),
    "",
    "## ספר חשבונות",
    ...brief.ledgerSummaryHe.map((line) => `• ${line}`),
    "",
    "## קניות ורכש",
    ...brief.procurementBulletsHe.map((line) => `• ${line}`),
    "",
    "## פרסום ושיווק",
    ...brief.marketingBulletsHe.map((line) => `• ${line}`),
    "",
    "## זיכרון אורחים",
    ...brief.guestMemoryBulletsHe.map((line) => `• ${line}`),
  ];
  if (brief.anomalyBulletsHe.length > 0) {
    lines.push("", "## אנומליות", ...brief.anomalyBulletsHe.map((l) => `• ${l}`));
  }
  if (brief.marketSnapshotsHe.length > 0) {
    lines.push(
      "",
      "## עדכוני שוק (Trusted)",
      ...brief.marketSnapshotsHe.slice(0, 6).map((l) => `• ${l}`),
    );
  }
  lines.push("", brief.guardrailHe);
  return lines.join("\n").trim();
}

function formatSmartCfoMessage(
  result: {
    readonly brief: Parameters<typeof formatFactsCfoMessage>[0];
    readonly narrativeHe: string;
    readonly suggestedActionsHe: readonly string[];
    readonly provider: string;
  },
  ingest: Parameters<typeof formatFactsCfoMessage>[1],
): string {
  const lines = [
    formatFactsCfoMessage(result.brief, ingest),
    "",
    "---",
    `ניתוח AI · agent.cfo (${result.provider}):`,
    result.narrativeHe,
  ];
  if (result.suggestedActionsHe.length > 0) {
    lines.push("", "פעולות מומלצות:");
    for (const action of result.suggestedActionsHe) {
      lines.push(`• ${action}`);
    }
  }
  lines.push("", "AI דרך Gateway בלבד · אין ביצוע כספי אוטונומי.");
  return lines.join("\n").trim();
}
