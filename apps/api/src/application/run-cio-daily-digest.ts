import type { AiGateway } from "@hotelos/ai-gateway";
import type {
  CompanyKnowledgeRepository,
  HotelRepository,
  NotificationRepository,
  OrgCommsRepository,
  TrustedSourcesRepository,
} from "@hotelos/database";
import { DEMO_CHAIN_ID, DEMO_TENANT_ID } from "@hotelos/database";
import { Ids, type HotelId, type TenantId } from "@hotelos/shared";
import { randomUUID } from "node:crypto";
import type { WhatsAppProvider } from "../infrastructure/whatsapp-provider.js";
import { normalizeWhatsAppTo } from "../infrastructure/whatsapp-provider.js";
import {
  buildCioDigest,
  type CioDigestDeps,
  type CioRole,
} from "./build-cio-digest.js";
import { deliverQueuedNotification } from "./enqueue-room-invite-notification.js";
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
  readonly trustedSources?: TrustedSourcesRepository;
  /** Stage ד' follow-up (PO decision 2) — scheduled WhatsApp copy of the digest. */
  readonly notifications?: NotificationRepository;
  readonly whatsapp?: WhatsAppProvider;
  /** Recipient for the WhatsApp digest copy; empty/absent = in-app only. */
  readonly digestWhatsAppTo?: string;
};

export type CioDailyDigestResult = {
  readonly tenantId: string;
  readonly role: CioRole;
  readonly channelId: string;
  readonly messageId: string;
  readonly headlineHe: string;
  readonly narrativeIncluded: boolean;
  readonly provider: string | null;
  readonly whatsappQueued: boolean;
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

  if (deps.gateway && deps.companyKnowledge && deps.trustedSources) {
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
        bookings: deps.bookings,
        gateway: deps.gateway,
        companyKnowledge: deps.companyKnowledge,
        trustedSources: deps.trustedSources,
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

  const whatsappQueued = await enqueueDigestWhatsAppCopy(deps, {
    tenantId,
    hotelId: Ids.hotel(hotelRows[0]!.id),
    headlineHe,
    generatedAtIso: now,
  });

  return {
    tenantId: String(tenantId),
    role,
    channelId: channel.id,
    messageId: message.id,
    headlineHe,
    narrativeIncluded,
    provider,
    whatsappQueued,
  };
}

/**
 * Best-effort WhatsApp copy of the digest headline (in-app inbox stays the
 * source of truth). Never fails the digest run when delivery is unavailable.
 */
async function enqueueDigestWhatsAppCopy(
  deps: RunCioDailyDigestDeps,
  input: {
    readonly tenantId: TenantId;
    readonly hotelId: HotelId;
    readonly headlineHe: string;
    readonly generatedAtIso: string;
  },
): Promise<boolean> {
  const to = deps.digestWhatsAppTo?.trim();
  if (!to || !deps.notifications || !deps.whatsapp) return false;

  try {
    const notification = await deps.notifications.enqueue({
      id: randomUUID(),
      tenantId: input.tenantId,
      hotelId: input.hotelId,
      channel: "whatsapp",
      eventKey: "cio_daily.digest",
      toAddress: normalizeWhatsAppTo(to),
      body: [
        "תדריך CIO יומי",
        input.headlineHe,
        `נשלח: ${new Date(input.generatedAtIso).toLocaleString("he-IL")}`,
        "לפרטים המלאים: תיבת הודעות ארגון (cio_daily).",
      ].join("\n"),
      status: "pending",
      provider: deps.whatsapp.name,
      createdAt: input.generatedAtIso,
    });
    await deliverQueuedNotification(deps.notifications, deps.whatsapp, notification);
    return true;
  } catch {
    return false;
  }
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
