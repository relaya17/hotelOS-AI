import type {
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

export type CfoFinanceBriefDeps = {
  readonly overview: OverviewRepository;
  readonly hotels: HotelRepository;
  readonly turbo: TurboRepository;
  readonly procurement: ProcurementRepository;
  readonly trustedSources: TrustedSourcesRepository;
  readonly snapshots: TrustedSourceSnapshotsRepository;
  readonly maintenance: MaintenanceRepository;
};

export type CfoFinanceBrief = {
  readonly generatedAt: string;
  readonly tenantName: string;
  readonly headlineHe: string;
  readonly hotelBulletsHe: readonly string[];
  readonly ledgerSummaryHe: readonly string[];
  readonly anomalyBulletsHe: readonly string[];
  readonly marketSourcesHe: readonly string[];
  readonly marketSnapshotsHe: readonly string[];
  readonly guardrailHe: string;
};

/**
 * Deterministic finance-doctor brief for agent.cfo — ledger + ops money signals
 * + Trusted market allowlist + latest feed snapshots. No LLM.
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
  for (const hotel of scopedHotels) {
    const orders = await deps.procurement.listPurchaseOrders(tenantId, hotel.id);
    const openOrders = orders.filter(
      (order) => order.status !== "received" && order.status !== "cancelled",
    );
    const openPoValue = openOrders.reduce(
      (sum, order) => sum + order.totalAmount,
      0,
    );
    const occupancyPercent =
      hotel.rooms.total === 0
        ? 0
        : Math.round((hotel.rooms.occupied / hotel.rooms.total) * 100);
    hotelBulletsHe.push(
      `${hotel.name}: תפוסה ${occupancyPercent}% · הזמנות פעילות ${hotel.bookings.active} · רכש פתוח ${(openPoValue / 100).toLocaleString("he-IL")} ₪ (${openOrders.length})`,
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

  const headlineHe =
    anomalyBulletsHe.length > 0
      ? `תדריך כספים · ${anomalyBulletsHe.length} אותות לבדיקה · ${scopedHotels.length} מלונות`
      : `תדריך כספים · מצב יציב יחסית · ${scopedHotels.length} מלונות · עדכון שוק מ־Trusted`;

  return {
    generatedAt,
    tenantName: chain.tenantName,
    headlineHe,
    hotelBulletsHe,
    ledgerSummaryHe,
    anomalyBulletsHe,
    marketSourcesHe,
    marketSnapshotsHe,
    guardrailHe:
      "סוכן כספים (agent.cfo) מציע בלבד · אין העברות/סגירת ספרים בלי אישור אנושי · עובדות חיצוניות רק ממקורות Trusted מאושרים.",
  };
}

export function formatCfoFinanceBriefPack(brief: CfoFinanceBrief): string {
  const lines = [
    "Context pack — Finance Doctor / agent.cfo",
    `רשת: ${brief.tenantName}`,
    brief.headlineHe,
    `נוצר: ${brief.generatedAt}`,
    "",
    "## מלונות",
    ...brief.hotelBulletsHe.map((line) => `• ${line}`),
    "",
    "## ספר חשבונות",
    ...brief.ledgerSummaryHe.map((line) => `• ${line}`),
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
