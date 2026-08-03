import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ANOMALY_AMOUNT_THRESHOLD_MINOR,
  BASELINE_WINDOW_DAYS,
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

  it("flags a journal amount as a statistical outlier (mean + 2σ) with 5+ rows", () => {
    const journal = [
      { id: "j1", memo: "a", debit: 1000, credit: 0, entryDate: "2026-07-14", accountName: "קופה" },
      { id: "j2", memo: "b", debit: 1050, credit: 0, entryDate: "2026-07-15", accountName: "קופה" },
      { id: "j3", memo: "c", debit: 950, credit: 0, entryDate: "2026-07-16", accountName: "קופה" },
      { id: "j4", memo: "d", debit: 1020, credit: 0, entryDate: "2026-07-17", accountName: "קופה" },
      { id: "j5", memo: "e", debit: 980, credit: 0, entryDate: "2026-07-17", accountName: "קופה" },
      { id: "j6", memo: "outlier", debit: 5_000, credit: 0, entryDate: "2026-07-18", accountName: "קופה" },
    ];
    const findings = detectOpsAnomalies({ nowIso: now, hotels: [], journal });
    const outliers = findings.filter((f) => f.type === "journal_amount_outlier");
    assert.equal(outliers.length, 1);
    assert.equal(outliers[0]?.resourceId, "j6");
    assert.match(outliers[0]?.evidenceHe ?? "", /baseline 90 יום/);
  });

  it("does not run statistical outlier detection with fewer than 5 journal rows", () => {
    const journal = [
      { id: "j1", memo: "a", debit: 1000, credit: 0, entryDate: "2026-07-14", accountName: "קופה" },
      { id: "j2", memo: "outlier", debit: 50_000, credit: 0, entryDate: "2026-07-18", accountName: "קופה" },
    ];
    const findings = detectOpsAnomalies({ nowIso: now, hotels: [], journal });
    assert.equal(findings.some((f) => f.type === "journal_amount_outlier"), false);
  });

  it("does not flag journal outliers outside the recent window", () => {
    const oldDate = new Date(Date.parse(now) - (BASELINE_WINDOW_DAYS + 5) * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const journal = [
      { id: "j1", memo: "a", debit: 1000, credit: 0, entryDate: oldDate, accountName: "קופה" },
      { id: "j2", memo: "b", debit: 1050, credit: 0, entryDate: oldDate, accountName: "קופה" },
      { id: "j3", memo: "c", debit: 950, credit: 0, entryDate: oldDate, accountName: "קופה" },
      { id: "j4", memo: "d", debit: 1020, credit: 0, entryDate: oldDate, accountName: "קופה" },
      { id: "j5", memo: "e", debit: 980, credit: 0, entryDate: oldDate, accountName: "קופה" },
      { id: "j6", memo: "old outlier", debit: 50_000, credit: 0, entryDate: oldDate, accountName: "קופה" },
    ];
    const findings = detectOpsAnomalies({ nowIso: now, hotels: [], journal });
    assert.equal(findings.some((f) => f.type === "journal_amount_outlier"), false);
  });

  it("groups journal outlier baselines per account", () => {
    const journal = [
      { id: "j1", memo: "a", debit: 1000, credit: 0, entryDate: "2026-07-14", accountName: "קופה" },
      { id: "j2", memo: "b", debit: 1050, credit: 0, entryDate: "2026-07-15", accountName: "קופה" },
      { id: "j3", memo: "c", debit: 950, credit: 0, entryDate: "2026-07-16", accountName: "קופה" },
      { id: "j4", memo: "d", debit: 1020, credit: 0, entryDate: "2026-07-17", accountName: "קופה" },
      { id: "j5", memo: "e", debit: 980, credit: 0, entryDate: "2026-07-17", accountName: "קופה" },
      { id: "j6", memo: "outlier", debit: 5_000, credit: 0, entryDate: "2026-07-18", accountName: "קופה" },
      { id: "j7", memo: "big payroll", debit: 500_000, credit: 0, entryDate: "2026-07-18", accountName: "שכר" },
    ];
    const findings = detectOpsAnomalies({ nowIso: now, hotels: [], journal });
    const outliers = findings.filter((f) => f.type === "journal_amount_outlier");
    assert.equal(outliers.length, 1);
    assert.equal(outliers[0]?.resourceId, "j6");
  });

  it("flags a purchase order as a statistical outlier with 5+ historical orders", () => {
    const baseOrders = [
      { id: "po1", status: "received", totalAmount: 50_000, currency: "ILS", createdAt: "2026-07-10T10:00:00.000Z" },
      { id: "po2", status: "received", totalAmount: 52_000, currency: "ILS", createdAt: "2026-07-11T10:00:00.000Z" },
      { id: "po3", status: "received", totalAmount: 48_000, currency: "ILS", createdAt: "2026-07-12T10:00:00.000Z" },
      { id: "po4", status: "received", totalAmount: 51_000, currency: "ILS", createdAt: "2026-07-13T10:00:00.000Z" },
      { id: "po5", status: "received", totalAmount: 49_500, currency: "ILS", createdAt: "2026-07-14T10:00:00.000Z" },
      { id: "po6", status: "submitted", totalAmount: 120_000, currency: "ILS", createdAt: "2026-07-18T10:00:00.000Z" },
    ];
    const findings = detectOpsAnomalies({
      nowIso: now,
      hotels: [
        {
          hotelId: "h1",
          hotelName: "דמו",
          inventory: [],
          maintenance: [],
          purchaseOrders: baseOrders,
        },
      ],
    });
    const outliers = findings.filter((f) => f.type === "purchase_order_amount_outlier");
    assert.equal(outliers.length, 1);
    assert.equal(outliers[0]?.resourceId, "po6");
    assert.match(outliers[0]?.evidenceHe ?? "", /baseline 90 יום/);
  });

  it("skips PO statistical detection when createdAt is missing", () => {
    const findings = detectOpsAnomalies({
      nowIso: now,
      hotels: [
        {
          hotelId: "h1",
          hotelName: "דמו",
          inventory: [],
          maintenance: [],
          purchaseOrders: [
            { id: "po1", status: "received", totalAmount: 50_000, currency: "ILS" },
            { id: "po2", status: "received", totalAmount: 52_000, currency: "ILS" },
            { id: "po3", status: "received", totalAmount: 48_000, currency: "ILS" },
            { id: "po4", status: "received", totalAmount: 51_000, currency: "ILS" },
            { id: "po5", status: "received", totalAmount: 49_500, currency: "ILS" },
            { id: "po6", status: "submitted", totalAmount: 120_000, currency: "ILS" },
          ],
        },
      ],
    });
    assert.equal(findings.some((f) => f.type === "purchase_order_amount_outlier"), false);
  });
});
