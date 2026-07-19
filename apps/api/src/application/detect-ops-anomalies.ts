/** Human-approval threshold aligned with Vol. 5 / PO defaults (₪2,000). */
export const ANOMALY_AMOUNT_THRESHOLD_MINOR = 200_000;

/** Urgent/high maintenance open longer than this is an SLA risk. */
export const URGENT_MAINTENANCE_SLA_MS = 24 * 60 * 60 * 1000;

export type OpsAnomalyType =
  | "low_stock"
  | "stale_urgent_maintenance"
  | "large_purchase_order"
  | "large_journal_entry"
  | "same_day_maintenance_close";

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

/**
 * Deterministic threshold rules — Stage ה' MVP (no ML / history baselines).
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
  }

  for (const entry of input.journal ?? []) {
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

  return findings.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
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
