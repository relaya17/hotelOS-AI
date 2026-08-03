import type {
  AuditRepository,
  BookingRepository,
  GuestProfileRepository,
  GuestStayRepository,
  HotelRepository,
  OpsRepository,
  RoomRepository,
  TrustRepository,
  TurboRepository,
} from "@hotelos/database";
import { runPublicBookAssistant } from "./run-public-book-assistant.js";

export type WhatsAppInboundResult = {
  readonly intent: "book" | "service" | "stay_lookup" | "help";
  readonly replyHe: string;
  readonly booked?: {
    readonly bookingId: string;
    readonly guestEmail: string;
  };
};

function looksLikeBooking(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("הזמנ") ||
    t.includes("חדר") ||
    t.includes("מחר") ||
    t.includes("לילה") ||
    t.includes("book") ||
    t.includes("room") ||
    t.includes("@")
  );
}

function looksLikeService(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("מגבות") ||
    t.includes("ניקיון") ||
    t.includes("שירות") ||
    t.includes("towels") ||
    t.includes("cleaning") ||
    t.includes("amenities")
  );
}

/**
 * Deterministic inbound WhatsApp router — booking assistant or service help.
 * Returns reply text for the messaging provider to send back.
 */
export async function handleWhatsAppInbound(
  deps: {
    readonly hotels: HotelRepository;
    readonly rooms: RoomRepository;
    readonly bookings: BookingRepository;
    readonly audit: AuditRepository;
    readonly trust: TrustRepository;
    readonly guestStays: GuestStayRepository;
    readonly ops: OpsRepository;
    readonly turbo: TurboRepository;
    readonly guestProfiles?: GuestProfileRepository;
  },
  input: {
    readonly from: string;
    readonly body: string;
    readonly hotelId?: string;
  },
): Promise<WhatsAppInboundResult> {
  const text = input.body.trim();
  if (text.length === 0) {
    return {
      intent: "help",
      replyHe:
        "HotelOS כאן. אפשר לכתוב בקשת הזמנה (תאריכים + שם + אימייל) או בקשת שירות לחדר.",
    };
  }

  if (looksLikeService(text) && !looksLikeBooking(text)) {
    return {
      intent: "service",
      replyHe:
        "לבקשת שירות לחדר פתחו את אזור האישי (StayHub) עם האימייל של ההזמנה, או כתבו את האימייל כאן יחד עם הבקשה (מגבות / ניקיון / שירותי חדר).",
    };
  }

  if (looksLikeBooking(text)) {
    const hotels = await deps.hotels.listAll();
    const hotelId = input.hotelId ?? hotels[0]?.id;
    const result = await runPublicBookAssistant(
      {
        hotels: deps.hotels,
        rooms: deps.rooms,
        bookings: deps.bookings,
        audit: deps.audit,
        trust: deps.trust,
        turbo: deps.turbo,
        ops: deps.ops,
        ...(deps.guestProfiles ? { guestProfiles: deps.guestProfiles } : {}),
      },
      {
        message: text,
        ...(hotelId
          ? {
              draft: {
                hotelId,
                guestPhone: input.from,
              },
            }
          : { draft: { guestPhone: input.from } }),
      },
    );

    if (result.booked) {
      return {
        intent: "book",
        replyHe: result.replyHe,
        booked: {
          bookingId: result.booked.bookingId,
          guestEmail: result.booked.guestEmail,
        },
      };
    }

    return {
      intent: "book",
      replyHe: result.replyHe,
    };
  }

  // Email-only → stay lookup hint
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
    const stays = await deps.guestStays.lookupByEmail(text.toLowerCase());
    if (stays.length === 0) {
      return {
        intent: "stay_lookup",
        replyHe: "לא מצאתי שהייה פעילה לאימייל זה. אפשר להזמין כאן בשיחה.",
      };
    }
    const stay = stays[0]!;
    return {
      intent: "stay_lookup",
      replyHe: `מצאתי שהייה ב־${stay.hotelName}, חדר ${stay.roomNumber}, ${stay.checkInDate} → ${stay.checkOutDate}. להמשך פעולות היכנסו ל־StayHub.`,
    };
  }

  return {
    intent: "help",
    replyHe:
      "אפשר להזמין («מחר ליומיים דלוקס שמי… אימייל…»), לבדוק שהייה (שלחו אימייל), או לבקש שירות לחדר.",
  };
}
