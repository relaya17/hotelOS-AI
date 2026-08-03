import type {
  BookingRepository,
  HotelRepository,
  RoomRepository,
  AuditRepository,
  TrustRepository,
  GuestProfileRepository,
  TurboRepository,
  OpsRepository,
} from "@hotelos/database";
import { Ids } from "@hotelos/shared";
import { quoteRoomStay, ROOM_TYPE_LABELS_HE } from "./room-rates.js";
import { listPublicAvailability } from "./public-availability.js";
import { createPublicBooking } from "./create-public-booking.js";
import { fireAutomationTrigger } from "./fire-automation-trigger.js";

export type PublicBookDraft = {
  readonly hotelId?: string;
  readonly checkInDate?: string;
  readonly checkOutDate?: string;
  readonly roomType?: string;
  readonly guestName?: string;
  readonly guestEmail?: string;
  readonly guestPhone?: string;
};

export type PublicBookAssistantResult = {
  readonly replyHe: string;
  readonly draft: PublicBookDraft;
  readonly missing: readonly string[];
  readonly readyToConfirm: boolean;
  readonly offers: readonly {
    readonly roomType: string;
    readonly labelHe: string;
    readonly availableCount: number;
    readonly total: number;
    readonly currency: string;
  }[];
  readonly booked?: {
    readonly bookingId: string;
    readonly guestEmail: string;
    readonly hotelName: string;
    readonly checkInDate: string;
    readonly checkOutDate: string;
    readonly roomType: string;
    readonly total: number;
    readonly currency: string;
  };
};

function tomorrowIso(now = new Date()): string {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function plusDaysIso(from: string, days: number): string {
  const d = new Date(`${from}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function parseIsoDate(text: string): string | undefined {
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso?.[1]) return iso[1];
  const slash = text.match(/\b(\d{1,2})[./](\d{1,2})(?:[./](20\d{2}))?\b/);
  if (!slash) return undefined;
  const day = Number(slash[1]);
  const month = Number(slash[2]);
  const year = slash[3] ? Number(slash[3]) : new Date().getUTCFullYear();
  if (day < 1 || day > 31 || month < 1 || month > 12) return undefined;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseRoomType(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (lower.includes("סוויט") || lower.includes("suite")) return "suite";
  if (lower.includes("דלוקס") || lower.includes("deluxe")) return "deluxe";
  if (lower.includes("נוף") || lower.includes("sea")) return "sea_view";
  if (
    lower.includes("סטנדרט") ||
    lower.includes("רגיל") ||
    lower.includes("standard") ||
    lower.includes("זוגי")
  ) {
    return "standard";
  }
  return undefined;
}

function parseNights(text: string): number | undefined {
  const he = text.match(/ל(?:־)?(\d+|שלושה|שלוש|שניים|יומיים|ארבעה|חמישה)\s*ימ/);
  if (he?.[1]) {
    const map: Record<string, number> = {
      יומיים: 2,
      שניים: 2,
      שלושה: 3,
      שלוש: 3,
      ארבעה: 4,
      חמישה: 5,
    };
    if (map[he[1]]) return map[he[1]];
    const n = Number(he[1]);
    if (Number.isFinite(n) && n > 0 && n < 30) return n;
  }
  const en = text.match(/(\d+)\s*nights?/i);
  if (en?.[1]) {
    const n = Number(en[1]);
    if (Number.isFinite(n) && n > 0 && n < 30) return n;
  }
  if (text.includes("לילה אחד") || text.includes("לילה בודד")) return 1;
  return undefined;
}

function parseGuestFields(text: string): Partial<PublicBookDraft> {
  const email =
    text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase();
  const phone = text.match(
    /(?:טלפון|phone|נייד)?\s*:?\s*((?:\+972|0)[\d\- ]{8,14})/i,
  )?.[1];
  const nameMatch =
    text.match(/(?:שמי|שלי קוראים|אני)\s+([\u0590-\u05FF][\u0590-\u05FF\s'-]{1,48})/) ??
    text.match(
      /(?:name|guest)\s*[:=]\s*([A-Za-z][A-Za-z\s'-]{1,48})/i,
    );
  let guestName = nameMatch?.[1]?.trim();
  if (guestName) {
    guestName = guestName
      .replace(/\s+(המייל|אימייל|email|טלפון|phone)\b.*$/i, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }
  return {
    ...(guestName ? { guestName } : {}),
    ...(email ? { guestEmail: email } : {}),
    ...(phone ? { guestPhone: phone.replace(/\s+/g, "") } : {}),
  };
}

function isConfirm(text: string): boolean {
  const t = text.trim().toLowerCase();
  return (
    t === "כן" ||
    t === "yes" ||
    t.includes("אשר") ||
    t.includes("תאשר") ||
    t.includes("להזמין") ||
    t.includes("הזמן") ||
    t.includes("confirm") ||
    t.includes("book it") ||
    t.includes("שלם")
  );
}

function missingFields(draft: PublicBookDraft): string[] {
  const missing: string[] = [];
  if (!draft.hotelId) missing.push("hotelId");
  if (!draft.checkInDate) missing.push("checkInDate");
  if (!draft.checkOutDate) missing.push("checkOutDate");
  if (!draft.roomType) missing.push("roomType");
  if (!draft.guestName) missing.push("guestName");
  if (!draft.guestEmail) missing.push("guestEmail");
  return missing;
}

function mergeDraft(
  base: PublicBookDraft,
  patch: PublicBookDraft,
): PublicBookDraft {
  return {
    ...(base.hotelId || patch.hotelId
      ? { hotelId: patch.hotelId ?? base.hotelId }
      : {}),
    ...(base.checkInDate || patch.checkInDate
      ? { checkInDate: patch.checkInDate ?? base.checkInDate }
      : {}),
    ...(base.checkOutDate || patch.checkOutDate
      ? { checkOutDate: patch.checkOutDate ?? base.checkOutDate }
      : {}),
    ...(base.roomType || patch.roomType
      ? { roomType: patch.roomType ?? base.roomType }
      : {}),
    ...(base.guestName || patch.guestName
      ? { guestName: patch.guestName ?? base.guestName }
      : {}),
    ...(base.guestEmail || patch.guestEmail
      ? { guestEmail: patch.guestEmail ?? base.guestEmail }
      : {}),
    ...(base.guestPhone || patch.guestPhone
      ? { guestPhone: patch.guestPhone ?? base.guestPhone }
      : {}),
  };
}

function askNext(missing: readonly string[], draft: PublicBookDraft): string {
  if (missing.includes("checkInDate") || missing.includes("checkOutDate")) {
    return "מתי תרצו להגיע? אפשר להגיד למשל: מחר ליומיים, או תאריך כמו 15.8 ל־3 ימים.";
  }
  if (missing.includes("roomType")) {
    return "איזה סוג חדר? סטנדרט, דלוקס, סוויטה או נוף לים.";
  }
  if (missing.includes("guestName")) {
    return "מה השם בהזמנה? אפשר להגיד: שמי ישראל ישראלי.";
  }
  if (missing.includes("guestEmail")) {
    return "מה כתובת האימייל לקבלת האישור?";
  }
  const label =
    (draft.roomType && ROOM_TYPE_LABELS_HE[draft.roomType]) ?? draft.roomType;
  return `מוכן לאשר: ${draft.checkInDate} → ${draft.checkOutDate}, חדר ${label}, על שם ${draft.guestName} (${draft.guestEmail}). אמרו «כן» או «אשר» כדי להשלים תשלום דמו ולהזמין.`;
}

export async function runPublicBookAssistant(
  deps: {
    readonly hotels: HotelRepository;
    readonly rooms: RoomRepository;
    readonly bookings: BookingRepository;
    readonly audit: AuditRepository;
    readonly trust: TrustRepository;
    readonly guestProfiles?: GuestProfileRepository;
    readonly turbo?: TurboRepository;
    readonly ops?: OpsRepository;
  },
  input: {
    readonly message: string;
    readonly draft?: PublicBookDraft;
    readonly confirm?: boolean;
  },
): Promise<PublicBookAssistantResult> {
  const hotels = await deps.hotels.listAll();
  const defaultHotel = hotels[0];
  let draft: PublicBookDraft = {
    ...(defaultHotel ? { hotelId: defaultHotel.id } : {}),
    ...(input.draft ?? {}),
  };

  const message = input.message.trim();
  const lower = message.toLowerCase();

  // Relative dates
  let checkIn = draft.checkInDate;
  let checkOut = draft.checkOutDate;
  if (lower.includes("מחרתיים")) {
    checkIn = plusDaysIso(tomorrowIso(), 1);
  } else if (lower.includes("מחר") || lower.includes("tomorrow")) {
    checkIn = tomorrowIso();
  }
  const parsedDate = parseIsoDate(message);
  if (parsedDate) checkIn = parsedDate;

  const nights = parseNights(message);
  if (checkIn && nights) {
    checkOut = plusDaysIso(checkIn, nights);
  } else if (checkIn && !checkOut) {
    checkOut = plusDaysIso(checkIn, 2);
  }

  const roomType = parseRoomType(message) ?? draft.roomType;
  const guestFields = parseGuestFields(message);

  draft = mergeDraft(draft, {
    ...(checkIn ? { checkInDate: checkIn } : {}),
    ...(checkOut ? { checkOutDate: checkOut } : {}),
    ...(roomType ? { roomType } : {}),
    ...guestFields,
  });

  // Hotel name mention
  for (const hotel of hotels) {
    if (message.includes(hotel.name) || lower.includes(hotel.name.toLowerCase())) {
      draft = mergeDraft(draft, { hotelId: hotel.id });
    }
  }

  const missing = missingFields(draft);
  let offers: PublicBookAssistantResult["offers"] = [];

  if (draft.hotelId && draft.checkInDate && draft.checkOutDate) {
    const hotel = await deps.hotels.findById(Ids.hotel(draft.hotelId));
    if (hotel) {
      const rows = await listPublicAvailability({
        rooms: deps.rooms,
        bookings: deps.bookings,
        tenantId: hotel.tenantId,
        hotelId: hotel.id,
        checkInDate: draft.checkInDate,
        checkOutDate: draft.checkOutDate,
      });
      offers = rows.map((row) => {
        const quote = quoteRoomStay({
          roomType: row.roomType,
          checkInDate: draft.checkInDate!,
          checkOutDate: draft.checkOutDate!,
          currency: hotel.currency,
        });
        return {
          roomType: row.roomType,
          labelHe: row.labelHe,
          availableCount: row.availableCount,
          total: quote.total,
          currency: quote.currency,
        };
      });
      if (!draft.roomType && rows[0]) {
        draft = mergeDraft(draft, { roomType: rows[0].roomType });
      }
    }
  }

  const readyToConfirm = missingFields(draft).length === 0;
  const shouldBook = readyToConfirm && (input.confirm === true || isConfirm(message));

  if (shouldBook && draft.hotelId && draft.roomType && draft.guestName && draft.guestEmail && draft.checkInDate && draft.checkOutDate) {
    const result = await createPublicBooking(
      {
        hotels: deps.hotels,
        rooms: deps.rooms,
        bookings: deps.bookings,
        audit: deps.audit,
        trust: deps.trust,
        ...(deps.guestProfiles ? { guestProfiles: deps.guestProfiles } : {}),
      },
      {
        hotelId: draft.hotelId,
        roomType: draft.roomType,
        guestName: draft.guestName,
        guestEmail: draft.guestEmail,
        ...(draft.guestPhone ? { guestPhone: draft.guestPhone } : {}),
        checkInDate: draft.checkInDate,
        checkOutDate: draft.checkOutDate,
      },
    );
    if (!result.ok) {
      return {
        replyHe: `לא הצלחתי להשלים את ההזמנה: ${result.error.message}. אפשר לנסות תאריכים או סוג חדר אחר.`,
        draft,
        missing: missingFields(draft),
        readyToConfirm: false,
        offers,
      };
    }

    if (deps.turbo) {
      await fireAutomationTrigger(
        {
          turbo: deps.turbo,
          ...(deps.ops ? { ops: deps.ops } : {}),
        },
        {
          tenantId: result.value.booking.tenantId,
          hotelId: result.value.booking.hotelId,
          triggerKey: "booking.created",
          detail: `הזמנה ${result.value.booking.id} · ${result.value.booking.guestName} · ${result.value.booking.checkInDate}`,
          bookingId: result.value.booking.id,
          guestName: result.value.booking.guestName,
        },
      );
    }

    const hotelName =
      hotels.find((h) => h.id === result.value.booking.hotelId)?.name ?? "המלון";

    return {
      replyHe: `ההזמנה אושרה. ${hotelName}, ${result.value.booking.checkInDate} → ${result.value.booking.checkOutDate}. נפתח עבורכם אזור אישי (StayHub) עם האימייל ${result.value.booking.guestEmail}.`,
      draft,
      missing: [],
      readyToConfirm: false,
      offers,
      booked: {
        bookingId: result.value.booking.id,
        guestEmail: result.value.booking.guestEmail,
        hotelName,
        checkInDate: result.value.booking.checkInDate,
        checkOutDate: result.value.booking.checkOutDate,
        roomType: result.value.quote.roomType,
        total: result.value.quote.total,
        currency: result.value.quote.currency,
      },
    };
  }

  const stillMissing = missingFields(draft);
  let replyHe = askNext(stillMissing, draft);
  if (offers.length > 0 && !stillMissing.includes("checkInDate")) {
    const summary = offers
      .slice(0, 3)
      .map(
        (o) =>
          `${o.labelHe} (${o.availableCount} פנויים) · ${Math.round(o.total)} ${o.currency}`,
      )
      .join(" · ");
    replyHe = `${replyHe}\nזמין עכשיו: ${summary}`;
  }
  if (message.length === 0) {
    replyHe =
      "שלום, אני סוכן ההזמנות של HotelOS. אפשר לדבר או לכתוב — למשל: «מחר ליומיים, חדר דלוקס, שמי רחל, rachel@example.com».";
  }

  return {
    replyHe,
    draft,
    missing: stillMissing,
    readyToConfirm: stillMissing.length === 0,
    offers,
  };
}
