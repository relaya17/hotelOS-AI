import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ANOMALY_AMOUNT_THRESHOLD_MINOR,
  detectOpsAnomalies,
} from "./detect-ops-anomalies.js";

const now = "2026-07-19T12:00:00.000Z";

describe("detectOpsAnomalies", () => {
  it("flags low stock, stale urgent maintenance, large PO, and journal spikes", () => {
    const findings = detectOpsAnomalies({
      nowIso: now,
      hotels: [
        {
          hotelId: "h1",
          hotelName: "דמו ת״א",
          inventory: [
            {
              id: "inv1",
              name: "מגבות",
              currentStock: 2,
              reorderThreshold: 10,
              belowThreshold: true,
            },
          ],
          maintenance: [
            {
              id: "m1",
              title: "דליפת מים",
              description: "בחדר 214",
              priority: "urgent",
              status: "open",
              createdAt: "2026-07-17T10:00:00.000Z",
              updatedAt: "2026-07-17T10:00:00.000Z",
            },
            {
              id: "m2",
              title: "נורה",
              description: "קצר",
              priority: "low",
              status: "done",
              createdAt: "2026-07-19T08:00:00.000Z",
              updatedAt: "2026-07-19T09:00:00.000Z",
            },
          ],
          purchaseOrders: [
            {
              id: "po1",
              status: "submitted",
              totalAmount: ANOMALY_AMOUNT_THRESHOLD_MINOR,
              currency: "ILS",
            },
          ],
        },
      ],
      journal: [
        {
          id: "j1",
          memo: "העברה גדולה",
          debit: ANOMALY_AMOUNT_THRESHOLD_MINOR,
          credit: 0,
          entryDate: "2026-07-18",
          accountName: "קופה",
        },
      ],
    });

    const types = new Set(findings.map((f) => f.type));
    assert.ok(types.has("low_stock"));
    assert.ok(types.has("stale_urgent_maintenance"));
    assert.ok(types.has("same_day_maintenance_close"));
    assert.ok(types.has("large_purchase_order"));
    assert.ok(types.has("large_journal_entry"));
  });

  it("ignores healthy inventory and small amounts", () => {
    const findings = detectOpsAnomalies({
      nowIso: now,
      hotels: [
        {
          hotelId: "h1",
          hotelName: "דמו",
          inventory: [
            {
              id: "inv1",
              name: "סבון",
              currentStock: 50,
              reorderThreshold: 10,
              belowThreshold: false,
            },
          ],
          maintenance: [],
          purchaseOrders: [
            {
              id: "po1",
              status: "draft",
              totalAmount: 50_000,
              currency: "ILS",
            },
          ],
        },
      ],
      journal: [
        {
          id: "j1",
          memo: "קטן",
          debit: 1000,
          credit: 0,
          entryDate: "2026-07-18",
          accountName: "קופה",
        },
      ],
    });
    assert.equal(findings.length, 0);
  });
});
