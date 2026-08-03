import { randomUUID } from "node:crypto";
import type { AiGateway } from "@hotelos/ai-gateway";
import type {
  BookingUpsellContext,
  PersistedUpsellOffer,
  UpsellOfferType,
  UpsellRepository,
} from "@hotelos/database";
import type { BookingId, HotelId, TenantId } from "@hotelos/shared";

const GUEST_AGENT_ID = "agent.guest" as const;

export type UpsellRuleCopy = {
  readonly titleHe: string;
  readonly descriptionHe: string;
  readonly priceAmount: number;
};

export const DEFAULT_UPSELL_COPY: Record<UpsellOfferType, UpsellRuleCopy> = {
  late_checkout: {
    titleHe: "צ׳ק-אאוט מאוחר",
    descriptionHe: "האריכו את השהייה עד 14:00 — בלי לחץ בבוקר.",
    priceAmount: 150,
  },
  spa: {
    titleHe: "טיפול ספא",
    descriptionHe: "60 דקות עיסוי מרגיע — מושלם אחרי יום ארוך.",
    priceAmount: 280,
  },
  dinner: {
    titleHe: "ארוחת ערב",
    descriptionHe: "ארוחת שלושה מנות במסעדת המלון — שולחן לשניים.",
    priceAmount: 220,
  },
  room_upgrade: {
    titleHe: "שדרוג חדר",
    descriptionHe: "שדרוג לחדר מרווח יותר עם נוף — לפי זמינות.",
    priceAmount: 350,
  },
  other: {
    titleHe: "הצעה מיוחדת",
    descriptionHe: "חוויה נוספת במלון — שווה לבדוק.",
    priceAmount: 100,
  },
};

export function countStayNights(checkInDate: string, checkOutDate: string): number {
  const start = new Date(`${checkInDate}T12:00:00Z`).getTime();
  const end = new Date(`${checkOutDate}T12:00:00Z`).getTime();
  const diff = Math.round((end - start) / (24 * 60 * 60 * 1000));
  return diff > 0 ? diff : 0;
}

export function isStandardRoomType(roomType: string): boolean {
  const normalized = roomType.trim().toLowerCase();
  return normalized === "standard" || normalized === "base";
}

export function evaluateUpsellOfferTypes(
  ctx: BookingUpsellContext,
  todayIso: string,
): readonly UpsellOfferType[] {
  const types: UpsellOfferType[] = [];
  const isInHouse = ctx.status === "checked_in";
  const isCheckInToday = ctx.checkInDate === todayIso;

  if (isInHouse || isCheckInToday) {
    types.push("late_checkout", "spa");
  }

  if (countStayNights(ctx.checkInDate, ctx.checkOutDate) >= 2) {
    types.push("dinner");
  }

  if (isStandardRoomType(ctx.roomType)) {
    types.push("room_upgrade");
  }

  return [...new Set(types)];
}

export type ParsedUpsellCopy = {
  readonly titleHe: string;
  readonly descriptionHe: string;
};

export function parseUpsellCopyFromAnswer(answerHe: string): ParsedUpsellCopy | null {
  const titleMatch = /כותרת:\s*(.+)/i.exec(answerHe);
  const descriptionMatch = /תיאור:\s*(.+)/i.exec(answerHe);
  if (titleMatch?.[1] && descriptionMatch?.[1]) {
    return {
      titleHe: titleMatch[1].trim(),
      descriptionHe: descriptionMatch[1].trim(),
    };
  }

  const lines = answerHe
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("תשובת Gateway"));
  if (lines.length >= 2) {
    return {
      titleHe: lines[0] ?? "",
      descriptionHe: lines[1] ?? "",
    };
  }
  return null;
}

async function enrichOfferCopy(
  gateway: AiGateway,
  ctx: BookingUpsellContext,
  offerType: UpsellOfferType,
  baseCopy: UpsellRuleCopy,
  actorUserId: string,
): Promise<{ readonly copy: UpsellRuleCopy; readonly source: "rules" | "agent.guest" }> {
  const ai = await gateway.invoke({
    agentId: GUEST_AGENT_ID,
    message: [
      "נסח הצעת upsell קצרה לעברית.",
      `סוג: ${offerType}`,
      `אורח: ${ctx.guestName}`,
      `חדר: ${ctx.roomType}`,
      `צ׳ק-אין: ${ctx.checkInDate}`,
      `צ׳ק-אאוט: ${ctx.checkOutDate}`,
      "החזר בפורmat:",
      "כותרת: ...",
      "תיאור: ...",
    ].join("\n"),
    tenantId: String(ctx.tenantId),
    userId: actorUserId,
    locale: "he",
    contextPack: [
      `מלון · ${ctx.hotelId}`,
      `הצעה בסיס: ${baseCopy.titleHe} — ${baseCopy.descriptionHe}`,
    ].join("\n"),
  });

  if (ai.provider === "deterministic") {
    return { copy: baseCopy, source: "rules" };
  }

  const parsed = parseUpsellCopyFromAnswer(ai.answerHe);
  if (!parsed) {
    return { copy: baseCopy, source: "rules" };
  }

  return {
    copy: {
      titleHe: parsed.titleHe,
      descriptionHe: parsed.descriptionHe,
      priceAmount: baseCopy.priceAmount,
    },
    source: "agent.guest",
  };
}

export type SuggestGuestUpsellsResult =
  | { readonly ok: true; readonly offers: readonly PersistedUpsellOffer[] }
  | {
      readonly ok: false;
      readonly error: { readonly code: string; readonly message: string };
    };

export async function suggestGuestUpsells(
  upsells: UpsellRepository,
  gateway: AiGateway,
  input: {
    readonly tenantId: TenantId;
    readonly hotelId: HotelId;
    readonly bookingId: BookingId;
    readonly actorUserId: string;
    readonly now?: Date;
  },
): Promise<SuggestGuestUpsellsResult> {
  const ctx = await upsells.loadBookingContext(
    input.tenantId,
    input.hotelId,
    input.bookingId,
  );
  if (!ctx) {
    return {
      ok: false,
      error: { code: "BOOKING_NOT_FOUND", message: "הזמנה לא נמצאה" },
    };
  }

  if (ctx.status === "checked_out" || ctx.status === "cancelled") {
    return {
      ok: false,
      error: {
        code: "STAY_NOT_ACTIVE",
        message: "לא ניתן להציע upsell להזמנה שאינה פעילה",
      },
    };
  }

  const todayIso = (input.now ?? new Date()).toISOString().slice(0, 10);
  const offerTypes = evaluateUpsellOfferTypes(ctx, todayIso);
  const created: PersistedUpsellOffer[] = [];
  const nowIso = (input.now ?? new Date()).toISOString();

  for (const offerType of offerTypes) {
    const existing = await upsells.findSuggestedByBookingAndType(
      input.tenantId,
      input.hotelId,
      input.bookingId,
      offerType,
    );
    if (existing) {
      created.push(existing);
      continue;
    }

    const baseCopy = DEFAULT_UPSELL_COPY[offerType];
    const enriched = await enrichOfferCopy(
      gateway,
      ctx,
      offerType,
      baseCopy,
      input.actorUserId,
    );
    const offer = await upsells.createSuggested({
      id: randomUUID(),
      tenantId: input.tenantId,
      hotelId: input.hotelId,
      bookingId: input.bookingId,
      guestEmail: ctx.guestEmail,
      offerType,
      titleHe: enriched.copy.titleHe,
      descriptionHe: enriched.copy.descriptionHe,
      priceAmount: enriched.copy.priceAmount,
      currency: ctx.currency,
      source: enriched.source,
      suggestedAt: nowIso,
      createdAt: nowIso,
    });
    created.push(offer);
  }

  return { ok: true, offers: created };
}

export type DecideUpsellOfferResult =
  | { readonly ok: true; readonly offer: PersistedUpsellOffer }
  | {
      readonly ok: false;
      readonly error: { readonly code: string; readonly message: string };
    };

export async function decideUpsellOffer(
  upsells: UpsellRepository,
  input: {
    readonly tenantId: TenantId;
    readonly hotelId: HotelId;
    readonly offerId: string;
    readonly decision: "accepted" | "declined";
    readonly now?: Date;
  },
): Promise<DecideUpsellOfferResult> {
  const existing = await upsells.findByIdInHotel(
    input.tenantId,
    input.hotelId,
    input.offerId,
  );
  if (!existing) {
    return {
      ok: false,
      error: { code: "OFFER_NOT_FOUND", message: "הצעה לא נמצאה" },
    };
  }
  if (existing.status !== "suggested") {
    return {
      ok: false,
      error: {
        code: "OFFER_ALREADY_DECIDED",
        message: "ההצעה כבר נסגרה",
      },
    };
  }

  const decidedAt = (input.now ?? new Date()).toISOString();
  const updated = await upsells.decide(
    input.tenantId,
    input.hotelId,
    input.offerId,
    input.decision,
    decidedAt,
  );
  if (!updated) {
    return {
      ok: false,
      error: { code: "OFFER_NOT_FOUND", message: "הצעה לא נמצאה" },
    };
  }
  return { ok: true, offer: updated };
}

export function toPublicUpsellDto(offer: PersistedUpsellOffer): {
  readonly id: string;
  readonly offerType: UpsellOfferType;
  readonly titleHe: string;
  readonly descriptionHe: string;
  readonly priceAmount: number;
  readonly currency: string;
  readonly status: PersistedUpsellOffer["status"];
  readonly suggestedAt: string;
} {
  return {
    id: offer.id,
    offerType: offer.offerType,
    titleHe: offer.titleHe,
    descriptionHe: offer.descriptionHe,
    priceAmount: offer.priceAmount,
    currency: offer.currency,
    status: offer.status,
    suggestedAt: offer.suggestedAt,
  };
}
