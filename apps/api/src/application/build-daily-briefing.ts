import type {
  FeedbackRepository,
  MaintenanceRepository,
  OpsRepository,
  OverviewRepository,
  ProcurementRepository,
} from "@hotelos/database";
import type { HotelId, TenantId } from "@hotelos/shared";

export type DailyBriefingHotelSection = {
  readonly hotelId: string;
  readonly hotelName: string;
  readonly occupancyPercent: number;
  readonly activeBookings: number;
  readonly roomsNeedingCleaning: number;
  readonly departmentCount: number;
  readonly openMaintenanceRequests: number;
  readonly urgentMaintenanceRequests: number;
  readonly lowStockItems: number;
  readonly openPurchaseOrders: number;
  readonly averageFeedbackRating: number | null;
  readonly highlights: readonly string[];
  readonly warnings: readonly string[];
  readonly suggestedActions: readonly string[];
  readonly summaryHe: string;
};

export type DailyBriefing = {
  readonly generatedAt: string;
  readonly tenantName: string;
  readonly hotels: readonly DailyBriefingHotelSection[];
  readonly chainSummaryHe: string | null;
};

export type DailyBriefingDeps = {
  readonly overview: OverviewRepository;
  readonly ops: OpsRepository;
  readonly maintenance: MaintenanceRepository;
  readonly procurement: ProcurementRepository;
  readonly feedback: FeedbackRepository;
};

/**
 * Deterministic, template-based daily briefing — no external LLM call.
 * The repo currently has no wired LLM provider (see docs/planning/
 * smart-integrations-and-hardening.md §4.1); this mirrors the existing
 * `consult-briefing-agent.ts` convention of rule-based Hebrew synthesis
 * over live operational data, scoped by tenancy (hotel manager vs. chain).
 */
export async function buildDailyBriefing(
  deps: DailyBriefingDeps,
  tenantId: TenantId,
  hotelIds: readonly HotelId[],
): Promise<DailyBriefing | null> {
  const chain = await deps.overview.getChainOverview(tenantId);
  if (!chain) {
    return null;
  }

  const idSet = new Set<string>(hotelIds);
  const scopedHotels = chain.hotels.filter((hotel) => idSet.has(hotel.id));

  const sections = await Promise.all(
    scopedHotels.map(async (hotel): Promise<DailyBriefingHotelSection> => {
      const hotelId = hotel.id;
      const [departments, requests, inventory, orders, avgRating] =
        await Promise.all([
          deps.ops.listDepartments(tenantId, hotelId),
          deps.maintenance.listByHotel(tenantId, hotelId),
          deps.procurement.listInventory(tenantId, hotelId),
          deps.procurement.listPurchaseOrders(tenantId, hotelId),
          deps.feedback.averageRating(tenantId, hotelId),
        ]);

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
      const occupancyPercent =
        hotel.rooms.total === 0
          ? 0
          : Math.round((hotel.rooms.occupied / hotel.rooms.total) * 100);

      const highlights: string[] = [];
      const warnings: string[] = [];
      const suggestedActions: string[] = [];

      if (occupancyPercent >= 80) {
        highlights.push(`תפוסה גבוהה (${occupancyPercent}%) — צפוי יום עמוס.`);
      } else if (occupancyPercent <= 30) {
        warnings.push(`תפוסה נמוכה (${occupancyPercent}%) — כדאי לבדוק תמחור/שיווק.`);
      }

      if (avgRating !== null && avgRating >= 4.5) {
        highlights.push(`דירוג אורחים מעולה (${avgRating.toFixed(1)}/5).`);
      } else if (avgRating !== null && avgRating < 3.5) {
        warnings.push(`דירוג אורחים נמוך (${avgRating.toFixed(1)}/5) — מומלץ לבדוק משוב אחרון.`);
      }

      if (urgentRequests.length > 0) {
        warnings.push(`${urgentRequests.length} קריאות תחזוקה דחופות/בעדיפות גבוהה פתוחות.`);
        suggestedActions.push("לטפל תחילה בקריאות התחזוקה הדחופות ביותר.");
      }
      if (lowStock.length > 0) {
        warnings.push(`${lowStock.length} פריטי מלאי מתחת לסף ההזמנה מחדש.`);
        suggestedActions.push("לפתוח הזמנת רכש לפריטי המלאי החסרים.");
      }
      if (hotel.rooms.dirty > 0) {
        suggestedActions.push(`${hotel.rooms.dirty} חדרים ממתינים לניקיון.`);
      }
      if (openOrders.length > 0) {
        suggestedActions.push(`${openOrders.length} הזמנות רכש בתהליך — לעקוב אחרי קבלתן.`);
      }
      if (highlights.length === 0 && warnings.length === 0) {
        highlights.push("אין נקודות חריגות היום — התפעול תקין.");
      }

      const summaryHe =
        `${hotel.name}: תפוסה ${occupancyPercent}%, ${openRequests.length} קריאות תחזוקה פתוחות` +
        (urgentRequests.length > 0 ? ` (${urgentRequests.length} דחופות)` : "") +
        (lowStock.length > 0 ? `, ${lowStock.length} פריטי מלאי חסרים` : "") +
        (avgRating !== null ? `, דירוג אורחים ${avgRating.toFixed(1)}/5` : "") +
        ".";

      return {
        hotelId: hotel.id,
        hotelName: hotel.name,
        occupancyPercent,
        activeBookings: hotel.bookings.active,
        roomsNeedingCleaning: hotel.rooms.dirty,
        departmentCount: departments.length,
        openMaintenanceRequests: openRequests.length,
        urgentMaintenanceRequests: urgentRequests.length,
        lowStockItems: lowStock.length,
        openPurchaseOrders: openOrders.length,
        averageFeedbackRating: avgRating,
        highlights,
        warnings,
        suggestedActions,
        summaryHe,
      };
    }),
  );

  const chainSummaryHe =
    sections.length > 1
      ? `תדריך יומי לרשת ${chain.tenantName}: ${sections.length} מלונות · ` +
        `${sections.reduce((sum, s) => sum + s.urgentMaintenanceRequests, 0)} קריאות תחזוקה דחופות בסך הכל · ` +
        `${sections.reduce((sum, s) => sum + s.lowStockItems, 0)} פריטי מלאי חסרים ברשת.`
      : null;

  return {
    generatedAt: new Date().toISOString(),
    tenantName: chain.tenantName,
    hotels: sections,
    chainSummaryHe,
  };
}
