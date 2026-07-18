import type {
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

export type RunCioDailyDigestDeps = CioDigestDeps & {
  readonly hotels: HotelRepository;
  readonly orgComms: OrgCommsRepository;
};

export type CioDailyDigestResult = {
  readonly tenantId: string;
  readonly role: CioRole;
  readonly channelId: string;
  readonly messageId: string;
  readonly headlineHe: string;
};

/**
 * Scheduled CIO daily digest — deterministic data synthesis (no LLM).
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
  const digest = await buildCioDigest(deps, tenantId, hotelIds, role);
  if (!digest) return null;

  const chainId = Ids.chain(hotelRows[0]?.chainId ?? DEMO_CHAIN_ID);
  const now = new Date().toISOString();
  const channel = await deps.orgComms.ensureChannel({
    id: randomUUID(),
    tenantId,
    chainId,
    channelKey: "cio_daily",
    nameHe: "תדריך CIO יומי",
    createdAt: now,
  });

  const body = formatDigestMessage(digest);
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
    headlineHe: digest.headlineHe,
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
