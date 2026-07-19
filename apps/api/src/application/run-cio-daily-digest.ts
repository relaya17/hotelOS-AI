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
  buildCioDigest,
  type CioDigestDeps,
  type CioRole,
} from "./build-cio-digest.js";
import { synthesizeCioDigest } from "./synthesize-cio-digest.js";

/** Stable actor for scheduled Gateway invokes (not a login user). */
const CRON_CIO_ACTOR_USER_ID = Ids.user(
  "00000000-0000-4000-8000-0000000000c1",
);

export type RunCioDailyDigestDeps = CioDigestDeps & {
  readonly hotels: HotelRepository;
  readonly orgComms: OrgCommsRepository;
  readonly gateway?: AiGateway;
  readonly companyKnowledge?: CompanyKnowledgeRepository;
};

export type CioDailyDigestResult = {
  readonly tenantId: string;
  readonly role: CioRole;
  readonly channelId: string;
  readonly messageId: string;
  readonly headlineHe: string;
  readonly narrativeIncluded: boolean;
  readonly provider: string | null;
};

/**
 * Scheduled CIO daily digest — facts always; Gateway narrative when wired.
 * Posts into org-comms channel `cio_daily` for the demo tenant (MVP).
 */
export async function runCioDailyDigest(
  deps: RunCioDailyDigestDeps,
  options?: { readonly role?: CioRole },
): Promise<CioDailyDigestResult | null> {
  const role = options?.role ?? "ceo";
  const tenantId = Ids.tenant(DEMO_TENANT_ID);
  const hotelRows = await deps.hotels.listByTenant(tenantId);
  if (hotelRows.length === 0) return null;

  const hotelIds = hotelRows.map((hotel) => hotel.id);
  const now = new Date().toISOString();

  let body: string;
  let headlineHe: string;
  let narrativeIncluded = false;
  let provider: string | null = null;

  if (deps.gateway && deps.companyKnowledge) {
    const synthesized = await synthesizeCioDigest(
      {
        overview: deps.overview,
        ops: deps.ops,
        maintenance: deps.maintenance,
        procurement: deps.procurement,
        feedback: deps.feedback,
        kashrut: deps.kashrut,
        hotels: deps.hotels,
        turbo: deps.turbo,
        gateway: deps.gateway,
        companyKnowledge: deps.companyKnowledge,
      },
      {
        tenantId,
        userId: CRON_CIO_ACTOR_USER_ID,
        hotelIds,
        role,
      },
    );
    if (!synthesized) return null;
    headlineHe = synthesized.digest.headlineHe;
    narrativeIncluded = true;
    provider = synthesized.provider;
    body = formatSmartDigestMessage(synthesized);
  } else {
    const digest = await buildCioDigest(deps, tenantId, hotelIds, role);
    if (!digest) return null;
    headlineHe = digest.headlineHe;
    body = formatDigestMessage(digest);
  }

  const chainId = Ids.chain(hotelRows[0]?.chainId ?? DEMO_CHAIN_ID);
  const channel = await deps.orgComms.ensureChannel({
    id: randomUUID(),
    tenantId,
    chainId,
    channelKey: "cio_daily",
    nameHe: "תדריך CIO יומי",
    createdAt: now,
  });

  const message = await deps.orgComms.addMessage({
    id: randomUUID(),
    tenantId,
    channelId: channel.id,
    fromRole: "agent.cio",
    body,
    createdAt: now,
  });
  if (!message) return null;

  return {
    tenantId: String(tenantId),
    role,
    channelId: channel.id,
    messageId: message.id,
    headlineHe,
    narrativeIncluded,
    provider,
  };
}

function formatDigestMessage(digest: {
  readonly roleLabelHe: string;
  readonly headlineHe: string;
  readonly generatedAt: string;
  readonly sections: readonly {
    readonly hotelName: string;
    readonly bulletsHe: readonly string[];
  }[];
}): string {
  const lines = [
    `תדריך יומי · ${digest.roleLabelHe}`,
    digest.headlineHe,
    `נוצר: ${digest.generatedAt}`,
    "",
  ];
  for (const section of digest.sections) {
    lines.push(`## ${section.hotelName}`);
    for (const bullet of section.bulletsHe) {
      lines.push(`• ${bullet}`);
    }
    lines.push("");
  }
  lines.push("מקור: נתוני תפעול חיים · ללא המלצות כספיות אוטונומיות.");
  return lines.join("\n").trim();
}

function formatSmartDigestMessage(result: {
  readonly digest: {
    readonly roleLabelHe: string;
    readonly headlineHe: string;
    readonly generatedAt: string;
    readonly sections: readonly {
      readonly hotelName: string;
      readonly bulletsHe: readonly string[];
    }[];
  };
  readonly narrativeHe: string;
  readonly suggestedActionsHe: readonly string[];
  readonly provider: string;
}): string {
  const lines = [
    formatDigestMessage(result.digest),
    "",
    "---",
    `סיכום AI (${result.provider}):`,
    result.narrativeHe,
  ];
  if (result.suggestedActionsHe.length > 0) {
    lines.push("", "פעולות מומלצות (מחולץ):");
    for (const action of result.suggestedActionsHe) {
      lines.push(`• ${action}`);
    }
  }
  lines.push(
    "",
    "AI דרך Gateway בלבד · אין ביצוע כספי אוטונומי.",
  );
  return lines.join("\n").trim();
}
