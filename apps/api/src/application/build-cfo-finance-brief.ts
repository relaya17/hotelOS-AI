import type {
  GuestProfileRepository,
  HotelRepository,
  MaintenanceRepository,
  OverviewRepository,
  ProcurementRepository,
  TrustedSourceSnapshotsRepository,
  TrustedSourcesRepository,
  TurboRepository,
} from "@hotelos/database";
import type { HotelId, TenantId } from "@hotelos/shared";
import { buildAccountingContextPack } from "./build-accounting-context-pack.js";
import { FINANCE_FEED_CATEGORIES } from "./ingest-trusted-market-feeds.js";
import { listOpsAnomalies } from "./run-anomaly-scan.js";

export const FINANCE_DOCTOR_AUDIENCES = [
  "owner",
  "ceo",
  "cfo",
  "gm",
  "procurement",
] as const;
export type FinanceDoctorAudience = (typeof FINANCE_DOCTOR_AUDIENCES)[number];

export const FINANCE_DOCTOR_FOCUSES = [
  "all",
  "finance",
  "procurement",
  "marketing",
  "investment",
] as const;
export type FinanceDoctorFocus = (typeof FINANCE_DOCTOR_FOCUSES)[number];

export const FINANCE_DOCTOR_AUDIENCE_LABELS_HE: Record<
  FinanceDoctorAudience,
  string
> = {
  owner: "בעלים",
  ceo: "מנכ״ל",
  cfo: "מנכ״ל כספים / CFO",
  gm: "מנהל מלון / GM",
  procurement: "רכש / קניין",
};

export const FINANCE_DOCTOR_FOCUS_LABELS_HE: Record<FinanceDoctorFocus, string> =
  {
    all: "הכל · כסף + קניות + שיווק",
    finance: "כספים ותזרים",
    procurement: "קניות ורכש",
    marketing: "פרסום ושיווק",
    investment: "השקעות (חינוכי)",
  };

export type CfoFinanceBriefDeps = {
  readonly overview: OverviewRepository;
  readonly hotels: HotelRepository;
  readonly turbo: TurboRepository;
  readonly procurement: ProcurementRepository;
  readonly trustedSources: TrustedSourcesRepository;
  readonly snapshots: TrustedSourceSnapshotsRepository;
  readonly maintenance: MaintenanceRepository;
  readonly guestProfiles?: GuestProfileRepository;
};

export type CfoFinanceBrief = {
  readonly generatedAt: string;
  readonly tenantName: string;
  readonly headlineHe: string;
  readonly hotels: readonly { readonly id: string; readonly name: string }[];
  readonly hotelBulletsHe: readonly string[];
  readonly ledgerSummaryHe: readonly string[];
  readonly procurementBulletsHe: readonly string[];
  readonly marketingBulletsHe: readonly string[];
  readonly guestMemoryBulletsHe: readonly string[];
  readonly anomalyBulletsHe: readonly string[];
  readonly marketSourcesHe: readonly string[];
  readonly marketSnapshotsHe: readonly string[];
  readonly guardrailHe: string;
};

/**
 * Deterministic finance-doctor brief — ledger + procurement + growth signals
 * + Trusted market allowlist + snapshots. No LLM.
 */
export async function buildCfoFinanceBrief(
  deps: CfoFinanceBriefDeps,
  tenantId: TenantId,
  hotelIds: readonly HotelId[],
): Promise<CfoFinanceBrief | null> {
  const chain = await deps.overview.getChainOverview(tenantId);
  if (!chain) return null;

  const idSet = new Set<string>(hotelIds);
  const scopedHotels = chain.hotels.filter((hotel) => idSet.has(hotel.id));
  const generatedAt = new Date().toISOString();

  const [accounts, journal, sources, pack, anomalies] = await Promise.all([
    deps.turbo.listAccounts(tenantId),
    deps.turbo.listJournal(tenantId),
    deps.trustedSources.list(tenantId),
    buildAccountingContextPack(deps.turbo, tenantId),
    listOpsAnomalies(
      {
        hotels: deps.hotels,
        maintenance: deps.maintenance,
        procurement: deps.procurement,
        turbo: deps.turbo,
      },
      { tenantId, hotelIds },
    ),
  ]);

  const financeSources = sources.filter((source) =>
    FINANCE_FEED_CATEGORIES.has(source.category),
  );
  const latestSnapshots = await deps.snapshots.listLatestOkForSources(
    tenantId,
    financeSources.map((source) => source.id),
  );

  const hotelBulletsHe: string[] = [];
  const procurementBulletsHe: string[] = [];
  const marketingBulletsHe: string[] = [];
  const hotels = scopedHotels.map((hotel) => ({
    id: hotel.id,
    name: hotel.name,
  }));

  for (const hotel of scopedHotels) {
    const [orders, inventory] = await Promise.all([
      deps.procurement.listPurchaseOrders(tenantId, hotel.id),
      deps.procurement.listInventory(tenantId, hotel.id),
    ]);
    const openOrders = orders.filter(
      (order) => order.status !== "received" && order.status !== "cancelled",
    );
    const openPoValue = openOrders.reduce(
      (sum, order) => sum + order.totalAmount,
      0,
    );
    const lowStock = inventory.filter((item) => item.belowThreshold);
    const occupancyPercent =
      hotel.rooms.total === 0
        ? 0
        : Math.round((hotel.rooms.occupied / hotel.rooms.total) * 100);
    const vacantRooms = hotel.rooms.vacant;

    hotelBulletsHe.push(
      `${hotel.name}: תפוסה ${occupancyPercent}% · הזמנות פעילות ${hotel.bookings.active} · רכש פתוח ${(openPoValue / 100).toLocaleString("he-IL")} ₪ (${openOrders.length})`,
    );

    procurementBulletsHe.push(
      openOrders.length > 0
        ? `${hotel.name}: ${openOrders.length} הזמנות רכש פתוחות · שווי ${(openPoValue / 100).toLocaleString("he-IL")} ₪ · מלאי נמוך: ${lowStock.length} פריטים`
        : `${hotel.name}: אין הזמנות רכש פתוחות · מלאי נמוך: ${lowStock.length} פריטים`,
    );
    if (lowStock.length > 0) {
      procurementBulletsHe.push(
        `${hotel.name}: לתעדף רכש — ${lowStock
          .slice(0, 4)
          .map((item) => item.name)
          .join(", ")}${lowStock.length > 4 ? "…" : ""}`,
      );
    }

    marketingBulletsHe.push(
      occupancyPercent < 70
        ? `${hotel.name}: תפוסה ${occupancyPercent}% · ${vacantRooms} חדרים פנויים — פוטנציאל לקמפיין/פרסום ישיר (באישור)`
        : `${hotel.name}: תפוסה ${occupancyPercent}% · מיקוד שיווק ב־upsell / החזרת אורחים / ADR`,
    );
    marketingBulletsHe.push(
      `${hotel.name}: ${hotel.bookings.confirmed} הזמנות confirmed · ${hotel.bookings.checkedIn} in-house — בסיס לסגמנט win-back/מבצע`,
    );
  }

  const totalBalanceMinor = accounts.reduce(
    (sum, account) => sum + account.balanceMinor,
    0,
  );
  const ledgerSummaryHe = [
    `ספר ראשי פנימי: ${accounts.length} חשבונות · ${journal.length} תנועות · יתרה מצטברת ${(totalBalanceMinor / 100).toLocaleString("he-IL")} ₪`,
  ];
  if (pack) {
    ledgerSummaryHe.push("פירוט חשבונות/יומן זמין ב־context pack ל־agent.cfo.");
  }

  const anomalyBulletsHe = anomalies
    .filter(
      (item) =>
        item.type === "large_journal_entry" ||
        item.type === "large_purchase_order" ||
        item.type === "journal_amount_outlier" ||
        item.type === "purchase_order_amount_outlier" ||
        item.type === "low_stock" ||
        item.severity === "high" ||
        item.severity === "urgent",
    )
    .slice(0, 8)
    .map((item) => `${item.titleHe}: ${item.evidenceHe}`);

  const marketSourcesHe = financeSources.map(
    (source) => `[${source.category}] ${source.title} — ${source.url}`,
  );
  const marketSnapshotsHe = latestSnapshots.map(
    (snap) =>
      `${snap.title} (${snap.fetchedAt.slice(0, 10)}): ${snap.summary.slice(0, 220)}${snap.summary.length > 220 ? "…" : ""}`,
  );

  const guestMemoryBulletsHe: string[] = [];
  if (deps.guestProfiles) {
    const [profileCount, recentGuests] = await Promise.all([
      deps.guestProfiles.countByTenant(tenantId),
      deps.guestProfiles.listRecent(tenantId, { limit: 5 }),
    ]);
    guestMemoryBulletsHe.push(
      `זיכרון אורחים: ${profileCount} פרופילים שמורים (אימייל) — לשיפור שירות/שיווק מאושר בלבד.`,
    );
    for (const guest of recentGuests) {
      guestMemoryBulletsHe.push(
        `${guest.displayName} · ${guest.email} · ${guest.stayCount} שהיות` +
          (guest.lastStayAt ? ` · אחרונה ${guest.lastStayAt.slice(0, 10)}` : ""),
      );
    }
  } else {
    guestMemoryBulletsHe.push(
      "זיכרון אורחים: לא מחובר עדיין במסלול זה.",
    );
  }

  const headlineHe =
    anomalyBulletsHe.length > 0
      ? `תדריך הנהלה · ${anomalyBulletsHe.length} אותות · כסף / קניין / שיווק / אורחים`
      : `תדריך הנהלה · ניהול נכון · ${scopedHotels.length} מלונות`;

  return {
    generatedAt,
    tenantName: chain.tenantName,
    headlineHe,
    hotels,
    hotelBulletsHe,
    ledgerSummaryHe,
    procurementBulletsHe,
    marketingBulletsHe,
    guestMemoryBulletsHe,
    anomalyBulletsHe,
    marketSourcesHe,
    marketSnapshotsHe,
    guardrailHe:
      "יועץ לבעלים/מנכ״ל/CFO/GM/רכש · קניות·פרסום·שיווק·תזרים·השקעות חינוכיות — הצעה בלבד · אין ביצוע מסחר/העברות · מעל ₪2,000 דורש אישור אדם · Trusted בלבד.",
  };
}

export function formatCfoFinanceBriefPack(brief: CfoFinanceBrief): string {
  const lines = [
    "Context pack — Finance Doctor (owner / CEO / CFO)",
    `רשת: ${brief.tenantName}`,
    brief.headlineHe,
    `נוצר: ${brief.generatedAt}`,
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
    "## פרסום ושיווק (אותות תפוסה/ביקוש)",
    ...brief.marketingBulletsHe.map((line) => `• ${line}`),
    "",
    "## זיכרון אורחים (CRM)",
    ...brief.guestMemoryBulletsHe.map((line) => `• ${line}`),
  ];
  if (brief.anomalyBulletsHe.length > 0) {
    lines.push(
      "",
      "## אנומליות / חריגות",
      ...brief.anomalyBulletsHe.map((line) => `• ${line}`),
    );
  }
  if (brief.marketSnapshotsHe.length > 0) {
    lines.push(
      "",
      "## עדכוני שוק/מקרו (snapshots מ־Trusted)",
      ...brief.marketSnapshotsHe.map((line) => `• ${line}`),
    );
  } else if (brief.marketSourcesHe.length > 0) {
    lines.push(
      "",
      "## מקורות Trusted (טרם נמשכו snapshots)",
      ...brief.marketSourcesHe.slice(0, 8).map((line) => `• ${line}`),
    );
  }
  lines.push("", brief.guardrailHe);
  return lines.join("\n");
}
