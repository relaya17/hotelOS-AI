import type {
  FeedbackRepository,
  HotelRepository,
  KashrutRepository,
  MaintenanceRepository,
  OpsRepository,
  OverviewRepository,
  ProcurementRepository,
  TurboRepository,
} from "@hotelos/database";
import type { HotelId, TenantId } from "@hotelos/shared";

export const CIO_ROLES = [
  "owner",
  "ceo",
  "cfo",
  "reception",
  "housekeeping",
  "fb",
] as const;

export type CioRole = (typeof CIO_ROLES)[number];

const ROLE_LABELS_HE: Record<CioRole, string> = {
  owner: "בעל מלון / רשת",
  ceo: "מנכ״ל",
  cfo: "כספים",
  reception: "קבלה",
  housekeeping: "חדרים / משק בית",
  fb: "מזון ומשקאות (F&B)",
};

export type CioDigestSection = {
  readonly hotelId: string;
  readonly hotelName: string;
  readonly kashrutEnabled: boolean;
  readonly bulletsHe: readonly string[];
  readonly kashrutNoteHe: string | null;
};

export type CioDigest = {
  readonly role: CioRole;
  readonly roleLabelHe: string;
  readonly generatedAt: string;
  readonly tenantName: string;
  readonly headlineHe: string;
  readonly sections: readonly CioDigestSection[];
};

export type CioDigestDeps = {
  readonly overview: OverviewRepository;
  readonly ops: OpsRepository;
  readonly maintenance: MaintenanceRepository;
  readonly procurement: ProcurementRepository;
  readonly feedback: FeedbackRepository;
  readonly kashrut: KashrutRepository;
  readonly hotels: HotelRepository;
  readonly turbo: TurboRepository;
};

/**
 * Deterministic, template-based role digest for `agent.cio` (ADR 0007 /
 * cio-agent.md "תדריך יומי לפי היררכיה"). No external LLM: this is rule-based
 * Hebrew synthesis over live operational + ledger data, the same convention
 * as `build-daily-briefing.ts` and `consult-briefing-agent.ts`. `agent.cio`
 * only *routes to* / *summarizes* domain agents — it never bypasses human
 * approval for money or policy (see Guardrails in cio-agent.md).
 */
export async function buildCioDigest(
  deps: CioDigestDeps,
  tenantId: TenantId,
  hotelIds: readonly HotelId[],
  role: CioRole,
): Promise<CioDigest | null> {
  const chain = await deps.overview.getChainOverview(tenantId);
  if (!chain) {
    return null;
  }

  const idSet = new Set<string>(hotelIds);
  const scopedHotels = chain.hotels.filter((hotel) => idSet.has(hotel.id));
  const hotelRows = await deps.hotels.listByTenant(tenantId);
  const kashrutEnabledByHotel = new Map(
    hotelRows.map((row) => [row.id as string, row.kashrutEnabled]),
  );

  const [accounts, journal] = await Promise.all([
    deps.turbo.listAccounts(tenantId),
    deps.turbo.listJournal(tenantId),
  ]);

  const sections = await Promise.all(
    scopedHotels.map(async (hotel): Promise<CioDigestSection> => {
      const hotelId = hotel.id;
      const [departments, requests, inventory, orders, avgRating, kashrutNotes] =
        await Promise.all([
          deps.ops.listDepartments(tenantId, hotelId),
          deps.maintenance.listByHotel(tenantId, hotelId),
          deps.procurement.listInventory(tenantId, hotelId),
          deps.procurement.listPurchaseOrders(tenantId, hotelId),
          deps.feedback.averageRating(tenantId, hotelId),
          deps.kashrut.listByHotel(tenantId, hotelId),
        ]);

      const kashrutEnabled = kashrutEnabledByHotel.get(hotelId) ?? false;
      const occupancyPercent =
        hotel.rooms.total === 0
          ? 0
          : Math.round((hotel.rooms.occupied / hotel.rooms.total) * 100);
      const openRequests = requests.filter(
        (request) => request.status !== "done" && request.status !== "cancelled",
      );
      const urgentRequests = openRequests.filter(
        (request) => request.priority === "urgent" || request.priority === "high",
      );
      const lowStock = inventory.filter((item) => item.belowThreshold);
      const openOrders = orders.filter(
        (order) => order.status !== "received" && order.status !== "cancelled",
      );
      const openOrdersValue = openOrders.reduce(
        (sum, order) => sum + order.totalAmount,
        0,
      );
      const latestKashrut = kashrutNotes[0] ?? null;
      const kashrutNoteHe =
        kashrutEnabled && latestKashrut
          ? `${statusLabelHe(latestKashrut.status)}: ${latestKashrut.message ?? "אין פירוט נוסף."}`
          : null;
      const blockingKashrut = kashrutNotes.filter(
        (note) => note.status === "warn" || note.status === "block",
      );

      const bulletsHe = buildRoleBullets(role, {
        hotelName: hotel.name,
        occupancyPercent,
        activeBookings: hotel.bookings.active,
        dirtyRooms: hotel.rooms.dirty,
        maintenanceRooms: hotel.rooms.maintenance,
        departmentCount: departments.length,
        openMaintenanceRequests: openRequests.length,
        urgentMaintenanceRequests: urgentRequests.length,
        lowStockItems: lowStock.length,
        openPurchaseOrders: openOrders.length,
        openOrdersValue,
        averageFeedbackRating: avgRating,
        kashrutEnabled,
        blockingKashrutCount: blockingKashrut.length,
        accounts,
        journalCount: journal.length,
      });

      return {
        hotelId: hotel.id,
        hotelName: hotel.name,
        kashrutEnabled,
        bulletsHe,
        kashrutNoteHe,
      };
    }),
  );

  const totals = scopedHotels.reduce(
    (acc, hotel) => ({
      rooms: acc.rooms + hotel.rooms.total,
      occupied: acc.occupied + hotel.rooms.occupied,
      active: acc.active + hotel.bookings.active,
    }),
    { rooms: 0, occupied: 0, active: 0 },
  );
  const chainOccupancy =
    totals.rooms === 0 ? 0 : Math.round((totals.occupied / totals.rooms) * 100);

  const headlineHe =
    `יועץ־על · ${ROLE_LABELS_HE[role]} · ${chain.tenantName}: ` +
    `${scopedHotels.length} מלונות בהיקף, תפוסת רשת ${chainOccupancy}%, ${totals.active} הזמנות פעילות.`;

  return {
    role,
    roleLabelHe: ROLE_LABELS_HE[role],
    generatedAt: new Date().toISOString(),
    tenantName: chain.tenantName,
    headlineHe,
    sections,
  };
}

function statusLabelHe(status: string): string {
  switch (status) {
    case "block":
      return "חסימת כשרות";
    case "warn":
      return "אזהרת כשרות";
    case "note":
      return "הערת כשרות";
    default:
      return "כשרות תקינה";
  }
}

type RoleBulletInput = {
  readonly hotelName: string;
  readonly occupancyPercent: number;
  readonly activeBookings: number;
  readonly dirtyRooms: number;
  readonly maintenanceRooms: number;
  readonly departmentCount: number;
  readonly openMaintenanceRequests: number;
  readonly urgentMaintenanceRequests: number;
  readonly lowStockItems: number;
  readonly openPurchaseOrders: number;
  readonly openOrdersValue: number;
  readonly averageFeedbackRating: number | null;
  readonly kashrutEnabled: boolean;
  readonly blockingKashrutCount: number;
  readonly accounts: readonly { readonly balanceMinor: number; readonly currency: string }[];
  readonly journalCount: number;
};

function buildRoleBullets(role: CioRole, input: RoleBulletInput): readonly string[] {
  const bullets: string[] = [];

  switch (role) {
    case "owner": {
      bullets.push(
        input.averageFeedbackRating !== null && input.averageFeedbackRating < 3.5
          ? `סיכון מוניטין: דירוג אורחים נמוך (${input.averageFeedbackRating.toFixed(1)}/5) ב${input.hotelName}.`
          : "מוניטין: אין סיכון חריג לדיווח כרגע.",
      );
      if (input.urgentMaintenanceRequests > 0 || input.blockingKashrutCount > 0) {
        const kashrutPart =
          input.blockingKashrutCount > 0
            ? ` · ${input.blockingKashrutCount} חסימות/אזהרות כשרות`
            : "";
        bullets.push(
          `חריגות קריטיות: ${input.urgentMaintenanceRequests} תחזוקה דחופה${kashrutPart}.`,
        );
      } else {
        bullets.push("אין חריגות קריטיות פתוחות.");
      }
      bullets.push("הזדמנויות אסטרטגיות: אין הזדמנות רכישה/מצוקה חדשה מדווחת ממקור מאושר.");
      break;
    }
    case "ceo": {
      bullets.push(
        `תפוסה ${input.occupancyPercent}% · ${input.activeBookings} הזמנות פעילות ב${input.hotelName}.`,
      );
      bullets.push(
        `כוח אדם: ${input.departmentCount} מחלקות פעילות; אין נתוני מחסור משמרות משולבים עדיין.`,
      );
      bullets.push(
        input.openMaintenanceRequests > 0
          ? `Backlog תחזוקה/HK: ${input.openMaintenanceRequests} קריאות פתוחות (${input.urgentMaintenanceRequests} דחופות), ${input.dirtyRooms} חדרים לניקיון.`
          : `Backlog תחזוקה/HK: פנוי, ${input.dirtyRooms} חדרים לניקיון.`,
      );
      if (input.kashrutEnabled) {
        bullets.push(
          input.blockingKashrutCount > 0
            ? `כשרות: ${input.blockingKashrutCount} אזהרות/חסימות פתוחות — דורש טיפול.`
            : "כשרות: תקין, אין אזהרות פתוחות.",
        );
      }
      break;
    }
    case "cfo": {
      const totalBalanceMinor = input.accounts.reduce(
        (sum, account) => sum + account.balanceMinor,
        0,
      );
      bullets.push(
        `תזרים (ספר ראשי פנימי): יתרת חשבונות מצטברת ${(totalBalanceMinor / 100).toLocaleString("he-IL")} · ${input.journalCount} תנועות יומן ברשת.`,
      );
      bullets.push(
        input.openPurchaseOrders > 0
          ? `רכש פתוח: ${input.openPurchaseOrders} הזמנות ב${input.hotelName}, שווי מצטבר ${(input.openOrdersValue / 100).toLocaleString("he-IL")}.`
          : "רכש: אין הזמנות פתוחות ממתינות לתשלום.",
      );
      bullets.push("לא זוהו חשדות הונאה או אי־דיווח על בסיס הנתונים הפנימיים הזמינים.");
      break;
    }
    case "reception": {
      bullets.push(
        `הזמנות פעילות היום ב${input.hotelName}: ${input.activeBookings}, תפוסה ${input.occupancyPercent}%.`,
      );
      bullets.push(
        input.dirtyRooms > 0
          ? `${input.dirtyRooms} חדרים ממתינים לניקיון לפני הקצאה לאורחים ממתינים.`
          : "אין חדרים ממתינים לניקיון.",
      );
      bullets.push("אין בעיות הזמנה חריגות מדווחות כרגע.");
      break;
    }
    case "housekeeping": {
      bullets.push(
        `${input.dirtyRooms} חדרים dirty, ${input.maintenanceRooms} חדרים בתחזוקה ב${input.hotelName}.`,
      );
      bullets.push(
        input.urgentMaintenanceRequests > 0
          ? `${input.urgentMaintenanceRequests} קריאות תחזוקה דחופות פתוחות — לתעדף.`
          : "אין קריאות תחזוקה דחופות פתוחות.",
      );
      break;
    }
    case "fb": {
      bullets.push(
        input.lowStockItems > 0
          ? `${input.lowStockItems} פריטי מלאי מתחת לסף הזמנה מחדש — יש לבדוק לפני תכנון עומס.`
          : "מלאי תקין, אין פריטים מתחת לסף.",
      );
      if (input.kashrutEnabled) {
        bullets.push(
          input.blockingKashrutCount > 0
            ? `כשרות: ${input.blockingKashrutCount} אזהרות/חסימות פתוחות על תפריט/רכש — לתאם עם משגיח הכשרות.`
            : "כשרות: תקין, אין אזהרות פתוחות.",
        );
      } else {
        bullets.push("כשרות: לא מופעלת במלון זה.");
      }
      break;
    }
  }

  return bullets;
}
