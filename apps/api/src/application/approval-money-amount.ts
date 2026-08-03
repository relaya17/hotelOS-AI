/**
 * Best-effort ILS amount from an AI approval payload (for RBAC thresholds).
 * Returns 0 when the payload is non-monetary or amount is unknown.
 */
export function estimateApprovalAmountIls(payloadJson: string): number {
  try {
    const payload = JSON.parse(payloadJson) as Record<string, unknown>;
    if (typeof payload["totalAmount"] === "number") {
      return Math.max(0, payload["totalAmount"]);
    }
    if (typeof payload["amount"] === "number") {
      return Math.max(0, payload["amount"]);
    }
    const items = payload["items"];
    if (Array.isArray(items)) {
      let total = 0;
      for (const item of items) {
        if (
          item &&
          typeof item === "object" &&
          typeof (item as { quantity?: unknown }).quantity === "number" &&
          typeof (item as { unitPrice?: unknown }).unitPrice === "number"
        ) {
          const row = item as { quantity: number; unitPrice: number };
          total += row.quantity * row.unitPrice;
        }
      }
      return Math.max(0, total);
    }
  } catch {
    // ignore malformed payloads — treat as non-monetary
  }
  return 0;
}

const MONEY_PAYLOAD_KINDS = new Set([
  "autonomy.procurement_draft",
  "autonomy.maintenance_quote_accept",
  "autonomy.procurement_send",
]);

export function isMoneyApprovalPayload(payloadJson: string): boolean {
  try {
    const payload = JSON.parse(payloadJson) as { kind?: unknown };
    return typeof payload.kind === "string" && MONEY_PAYLOAD_KINDS.has(payload.kind);
  } catch {
    return false;
  }
}
