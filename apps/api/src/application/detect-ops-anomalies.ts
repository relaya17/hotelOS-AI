/** Human-approval threshold aligned with Vol. 5 / PO defaults (₪2,000). */
export const ANOMALY_AMOUNT_THRESHOLD_MINOR = 200_000;

/** Urgent/high maintenance open longer than this is an SLA risk. */
export const URGENT_MAINTENANCE_SLA_MS = 24 * 60 * 60 * 1000;

/** Rolling baseline window for journal / PO statistical detection (days). */
export const BASELINE_WINDOW_DAYS = 90;

/** Only flag journal entries within this recent window (days). */
export const JOURNAL_OUTLIER_RECENT_DAYS = 14;

/** Only flag purchase orders within this recent window (days). */
export const PO_OUTLIER_RECENT_DAYS = 14;

export type OpsAnomalyType =
  | "low_stock"
  | "stale_urgent_maintenance"
  | "large_purchase_order"
  | "large_journal_entry"
  | "same_day_maintenance_close"
  | "journal_amount_outlier"
  | "purchase_order_amount_outlier";

/** Minimum journal rows before statistical (mean+2σ) outlier detection kicks in. */
export const JOURNAL_OUTLIER_MIN_ROWS = 5;

/** Minimum non-cancelled POs before statistical outlier detection kicks in. */
export const PO_OUTLIER_MIN_ROWS = 5;

/** Standard deviations above mean for statistical outlier threshold. */
export const OUTLIER_SIGMA_MULTIPLIER = 2;

export type OpsAnomalySeverity = "low" | "medium" | "high" | "urgent";

export type OpsAnomaly = {
  readonly fingerprint: string;
  readonly type: OpsAnomalyType;
  readonly severity: OpsAnomalySeverity;
  readonly hotelId: string | null;
  readonly titleHe: string;
  readonly evidenceHe: string;
  readonly detectedAt: string;
  readonly amountMinor?: number;
  readonly resourceType?: string;
  readonly resourceId?: string;
};

export type AnomalyHotelSnapshot = {
  readonly hotelId: string;
  readonly hotelName: string;
  readonly inventory: readonly {
    readonly id: string;
    readonly name: string;
    readonly currentStock: number;
    readonly reorderThreshold: number;
    readonly belowThreshold: boolean;
  }[];
  readonly maintenance: readonly {
    readonly id: string;
    readonly title: string;
    readonly description: string;
    readonly priority: string;
    readonly status: string;
    readonly createdAt: string;
    readonly updatedAt: string;
  }[];
  readonly purchaseOrders: readonly {
    readonly id: string;
    readonly status: string;
    readonly totalAmount: number;
    readonly currency: string;
    readonly createdAt?: string;
  }[];
};

export type AnomalyJournalRow = {
  readonly id: string;
  readonly memo: string;
  readonly debit: number;
  readonly credit: number;
  readonly entryDate: string;
  readonly accountName: string;
};

type AmountSample = {
  readonly id: string;
  readonly amount: number;
  readonly dateIso: string;
};

type MeanStddev = {
  readonly mean: number;
  readonly stddev: number;
  readonly n: number;
};

/**
 * Deterministic threshold rules — Stage ה' MVP (no ML).
 * Statistical baselines use rolling windows over existing journal/PO history.
 * Domain stays rule-based; optional narrative later via AI Gateway only.
 */
export function detectOpsAnomalies(input: {
  readonly nowIso?: string;
  readonly hotels: readonly AnomalyHotelSnapshot[];
  readonly journal?: readonly AnomalyJournalRow[];
}): readonly OpsAnomaly[] {
  const detectedAt = input.nowIso ?? new Date().toISOString();
  const nowMs = Date.parse(detectedAt);
  const findings: OpsAnomaly[] = [];

  for (const hotel of input.hotels) {
    for (const item of hotel.inventory) {
      if (!item.belowThreshold) continue;
      findings.push({
        fingerprint: `low_stock:${hotel.hotelId}:${item.id}`,
        type: "low_stock",
        severity: item.currentStock === 0 ? "urgent" : "high",
        hotelId: hotel.hotelId,
        titleHe: `מלאי נמוך: ${item.name}`,
        evidenceHe: `${hotel.hotelName}: מלאי ${item.currentStock} (סף ${item.reorderThreshold}).`,
        detectedAt,
        resourceType: "inventory_item",
        resourceId: item.id,
      });
    }

    for (const request of hotel.maintenance) {
      const open =
        request.status !== "done" && request.status !== "cancelled";
      const urgent =
        request.priority === "urgent" || request.priority === "high";
      if (open && urgent) {
        const ageMs = nowMs - Date.parse(request.createdAt);
        if (Number.isFinite(ageMs) && ageMs >= URGENT_MAINTENANCE_SLA_MS) {
          const hours = Math.floor(ageMs / (60 * 60 * 1000));
          findings.push({
            fingerprint: `stale_urgent_maintenance:${request.id}`,
            type: "stale_urgent_maintenance",
            severity: request.priority === "urgent" ? "urgent" : "high",
            hotelId: hotel.hotelId,
            titleHe: `תחזוקה דחופה חורגת SLA: ${request.title}`,
            evidenceHe: `${hotel.hotelName}: פתוחה כ־${hours} שעות (עדיפות ${request.priority}).`,
            detectedAt,
            resourceType: "maintenance_request",
            resourceId: request.id,
          });
        }
      }

      if (
        request.status === "done" &&
        sameUtcDay(request.createdAt, request.updatedAt) &&
        request.description.trim().length < 12
      ) {
        findings.push({
          fingerprint: `same_day_maintenance_close:${request.id}`,
          type: "same_day_maintenance_close",
          severity: "medium",
          hotelId: hotel.hotelId,
          titleHe: `סגירת תחזוקה מהירה ללא תיעוד: ${request.title}`,
          evidenceHe: `${hotel.hotelName}: נפתחה ונסגרה באותו יום עם תיאור קצר.`,
          detectedAt,
          resourceType: "maintenance_request",
          resourceId: request.id,
        });
      }
    }

    for (const order of hotel.purchaseOrders) {
      if (order.status === "cancelled") continue;
      if (order.totalAmount < ANOMALY_AMOUNT_THRESHOLD_MINOR) continue;
      findings.push({
        fingerprint: `large_purchase_order:${order.id}`,
        type: "large_purchase_order",
        severity: "high",
        hotelId: hotel.hotelId,
        titleHe: `הזמנת רכש מעל סף אישור`,
        evidenceHe: `${hotel.hotelName}: ${(order.totalAmount / 100).toLocaleString("he-IL")} ${order.currency} (סטטוס ${order.status}).`,
        detectedAt,
        amountMinor: order.totalAmount,
        resourceType: "purchase_order",
        resourceId: order.id,
      });
    }

    findings.push(
      ...detectPurchaseOrderAmountOutliers(hotel, detectedAt, nowMs),
    );
  }

  const journalRows = input.journal ?? [];
  for (const entry of journalRows) {
    const amount = Math.max(entry.debit, entry.credit);
    if (amount < ANOMALY_AMOUNT_THRESHOLD_MINOR) continue;
    findings.push({
      fingerprint: `large_journal_entry:${entry.id}`,
      type: "large_journal_entry",
      severity: "high",
      hotelId: null,
      titleHe: `תנועת יומן מעל סף אישור`,
      evidenceHe: `${entry.accountName}: ${(amount / 100).toLocaleString("he-IL")} · ${entry.memo || "ללא תיאור"} (${entry.entryDate}).`,
      detectedAt,
      amountMinor: amount,
      resourceType: "journal_entry",
      resourceId: entry.id,
    });
  }

  findings.push(...detectJournalAmountOutliers(journalRows, detectedAt, nowMs));

  return findings.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}

/**
 * Statistical baseline (mean + 2σ) over journal amounts within a rolling window,
 * grouped per account. Leave-one-out baseline excludes the candidate row.
 * Only recent entries (default 14d) are flagged.
 */
function detectJournalAmountOutliers(
  journal: readonly AnomalyJournalRow[],
  detectedAt: string,
  nowMs: number,
): readonly OpsAnomaly[] {
  if (!Number.isFinite(nowMs) || journal.length === 0) return [];

  const byAccount = groupBy(journal, (entry) => entry.accountName);
  const findings: OpsAnomaly[] = [];

  for (const [accountName, entries] of byAccount) {
    const samples: AmountSample[] = entries.map((entry) => ({
      id: entry.id,
      amount: Math.max(entry.debit, entry.credit),
      dateIso: entry.entryDate,
    }));

    const outliers = detectRollingAmountOutliers({
      samples,
      nowMs,
      baselineWindowDays: BASELINE_WINDOW_DAYS,
      recentWindowDays: JOURNAL_OUTLIER_RECENT_DAYS,
      minSamples: JOURNAL_OUTLIER_MIN_ROWS,
      sigmaMultiplier: OUTLIER_SIGMA_MULTIPLIER,
    });

    for (const outlier of outliers) {
      const entry = entries.find((row) => row.id === outlier.sample.id);
      if (!entry) continue;
      const { mean, stddev, n } = outlier.stats;
      const amount = outlier.sample.amount;
      findings.push({
        fingerprint: `journal_amount_outlier:${entry.id}`,
        type: "journal_amount_outlier",
        severity: "high",
        hotelId: null,
        titleHe: `תנועת יומן חריגה סטטיסטית (מעל ממוצע + 2σ)`,
        evidenceHe: `${accountName}: ${(amount / 100).toLocaleString("he-IL")} מול baseline ${BASELINE_WINDOW_DAYS} יום — ממוצע ${(mean / 100).toLocaleString("he-IL")} ± ${(stddev / 100).toLocaleString("he-IL")} (σ, n=${n}) · ${entry.memo || "ללא תיאור"} (${entry.entryDate}).`,
        detectedAt,
        amountMinor: amount,
        resourceType: "journal_entry",
        resourceId: entry.id,
      });
    }
  }

  return findings;
}

/**
 * Per-hotel PO amount outlier — same rolling mean+2σ approach as journal.
 */
function detectPurchaseOrderAmountOutliers(
  hotel: AnomalyHotelSnapshot,
  detectedAt: string,
  nowMs: number,
): readonly OpsAnomaly[] {
  if (!Number.isFinite(nowMs)) return [];

  const eligible = hotel.purchaseOrders.filter(
    (order) => order.status !== "cancelled" && order.createdAt !== undefined,
  );
  if (eligible.length === 0) return [];

  const samples: AmountSample[] = eligible.map((order) => ({
    id: order.id,
    amount: order.totalAmount,
    dateIso: order.createdAt as string,
  }));

  const outliers = detectRollingAmountOutliers({
    samples,
    nowMs,
    baselineWindowDays: BASELINE_WINDOW_DAYS,
    recentWindowDays: PO_OUTLIER_RECENT_DAYS,
    minSamples: PO_OUTLIER_MIN_ROWS,
    sigmaMultiplier: OUTLIER_SIGMA_MULTIPLIER,
  });

  const orderById = new Map(eligible.map((order) => [order.id, order]));

  return outliers.flatMap((outlier) => {
    const order = orderById.get(outlier.sample.id);
    if (!order) return [];
    const { mean, stddev, n } = outlier.stats;
    const amount = outlier.sample.amount;
    return [
      {
        fingerprint: `purchase_order_amount_outlier:${order.id}`,
        type: "purchase_order_amount_outlier" as const,
        severity: "high" as const,
        hotelId: hotel.hotelId,
        titleHe: `הזמנת רכש חריגה סטטיסטית (מעל ממוצע + 2σ)`,
        evidenceHe: `${hotel.hotelName}: ${(amount / 100).toLocaleString("he-IL")} ${order.currency} מול baseline ${BASELINE_WINDOW_DAYS} יום — ממוצע ${(mean / 100).toLocaleString("he-IL")} ± ${(stddev / 100).toLocaleString("he-IL")} (σ, n=${n}) · סטטוס ${order.status}.`,
        detectedAt,
        amountMinor: amount,
        resourceType: "purchase_order",
        resourceId: order.id,
      },
    ];
  });
}

function detectRollingAmountOutliers(input: {
  readonly samples: readonly AmountSample[];
  readonly nowMs: number;
  readonly baselineWindowDays: number;
  readonly recentWindowDays: number;
  readonly minSamples: number;
  readonly sigmaMultiplier: number;
}): readonly { readonly sample: AmountSample; readonly stats: MeanStddev }[] {
  const baselinePool = input.samples.filter((sample) =>
    isWithinDays(sample.dateIso, input.nowMs, input.baselineWindowDays),
  );
  const recentCandidates = baselinePool.filter((sample) =>
    isWithinDays(sample.dateIso, input.nowMs, input.recentWindowDays),
  );

  const findings: { sample: AmountSample; stats: MeanStddev }[] = [];

  for (const candidate of recentCandidates) {
    const baselineAmounts = baselinePool
      .filter((sample) => sample.id !== candidate.id)
      .map((sample) => sample.amount);
    const stats = computeMeanStddev(baselineAmounts);
    if (!stats || stats.n < input.minSamples) continue;

    const threshold = stats.mean + input.sigmaMultiplier * stats.stddev;
    if (candidate.amount <= threshold) continue;

    findings.push({ sample: candidate, stats });
  }

  return findings;
}

function computeMeanStddev(amounts: readonly number[]): MeanStddev | null {
  if (amounts.length === 0) return null;
  const mean = amounts.reduce((sum, value) => sum + value, 0) / amounts.length;
  const variance =
    amounts.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    amounts.length;
  const stddev = Math.sqrt(variance);
  if (stddev <= 0) return null;
  return { mean, stddev, n: amounts.length };
}

function isWithinDays(dateIso: string, nowMs: number, days: number): boolean {
  const ms = Date.parse(dateIso);
  if (!Number.isFinite(ms)) return false;
  return nowMs - ms <= days * 24 * 60 * 60 * 1000 && ms <= nowMs;
}

function groupBy<T>(
  items: readonly T[],
  keyFn: (item: T) => string,
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return map;
}

function sameUtcDay(aIso: string, bIso: string): boolean {
  const a = Date.parse(aIso);
  const b = Date.parse(bIso);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return (
    new Date(a).toISOString().slice(0, 10) ===
    new Date(b).toISOString().slice(0, 10)
  );
}

function severityRank(severity: OpsAnomalySeverity): number {
  switch (severity) {
    case "urgent":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    default:
      return 1;
  }
}
