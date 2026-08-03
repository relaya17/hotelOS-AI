import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Ids } from "@hotelos/shared";
import {
  detectPredictiveMaintenance,
  PM_MAINTENANCE_REPEAT_MIN,
  PM_MAINTENANCE_WINDOW_DAYS,
  PM_RUNTIME_THRESHOLDS,
  PM_TASK_RISK_THRESHOLD,
} from "./detect-predictive-maintenance.js";

const now = "2026-08-03T12:00:00.000Z";
const tenantId = Ids.tenant("00000000-0000-4000-8000-000000000001");
const hotelId = Ids.hotel("00000000-0000-4000-8000-000000000101");

const baseAsset = {
  id: "asset-hvac-1",
  tenantId,
  hotelId,
  code: "HVAC-LOBBY",
  nameHe: "צ'ילר לובי",
  category: "hvac" as const,
  locationHe: "לובי קומה 0",
  installDate: "2020-01-01",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("detectPredictiveMaintenance", () => {
  it("flags repeated maintenance, error codes, and runtime over threshold", () => {
    const findings = detectPredictiveMaintenance({
      nowIso: now,
      assets: [
        {
          asset: baseAsset,
          signals: [
            {
              id: "sig-1",
              assetId: baseAsset.id,
              tenantId: baseAsset.tenantId,
              hotelId: baseAsset.hotelId,
              signalType: "error_code",
              valueNum: null,
              valueText: "E42",
              recordedAt: "2026-08-02T10:00:00.000Z",
              source: "webhook",
              createdAt: "2026-08-02T10:00:00.000Z",
            },
            {
              id: "sig-2",
              assetId: baseAsset.id,
              tenantId: baseAsset.tenantId,
              hotelId: baseAsset.hotelId,
              signalType: "runtime_hours",
              valueNum: PM_RUNTIME_THRESHOLDS.hvac + 500,
              valueText: null,
              recordedAt: "2026-08-01T10:00:00.000Z",
              source: "webhook",
              createdAt: "2026-08-01T10:00:00.000Z",
            },
          ],
        },
      ],
      maintenanceRequests: [
        {
          id: "m1",
          tenantId: tenantId as string,
          hotelId: hotelId as string,
          category: "repair",
          title: "תקלה במיזוג לובי",
          description: "HVAC-LOBBY לא מקרר",
          priority: "high",
          status: "done",
          vendorId: null,
          dueAt: null,
          estimatedCost: null,
          actualCost: null,
          createdAt: "2026-07-10T08:00:00.000Z",
          updatedAt: "2026-07-11T08:00:00.000Z",
        },
        {
          id: "m2",
          tenantId: tenantId as string,
          hotelId: hotelId as string,
          category: "repair",
          title: "שוב מיזוג",
          description: "צ'ילר לובי",
          priority: "medium",
          status: "open",
          vendorId: null,
          dueAt: null,
          estimatedCost: null,
          actualCost: null,
          createdAt: "2026-07-25T08:00:00.000Z",
          updatedAt: "2026-07-25T08:00:00.000Z",
        },
      ],
    });

    const fingerprints = new Set(findings.map((item) => item.fingerprint));
    assert.ok(fingerprints.has(`repeat_maintenance:${baseAsset.id}`));
    assert.ok(fingerprints.has(`error_code:${baseAsset.id}`));
    assert.ok(fingerprints.has(`runtime_hours:${baseAsset.id}`));
    assert.ok(
      findings.some((item) => item.riskScore >= PM_TASK_RISK_THRESHOLD),
    );
  });

  it("applies elevator vibration and boiler temperature heuristics", () => {
    const findings = detectPredictiveMaintenance({
      nowIso: now,
      assets: [
        {
          asset: {
            ...baseAsset,
            id: "asset-elevator-1",
            code: "ELV-A",
            nameHe: "מעלית A",
            category: "elevator",
            locationHe: "מעלית A",
          },
          signals: [
            {
              id: "sig-vib",
              assetId: "asset-elevator-1",
              tenantId: baseAsset.tenantId,
              hotelId: baseAsset.hotelId,
              signalType: "vibration",
              valueNum: 6.2,
              valueText: null,
              recordedAt: "2026-08-03T09:00:00.000Z",
              source: "webhook",
              createdAt: "2026-08-03T09:00:00.000Z",
            },
          ],
        },
        {
          asset: {
            ...baseAsset,
            id: "asset-boiler-1",
            code: "BOILER-1",
            nameHe: "דוד מרכזי",
            category: "boiler",
            locationHe: "חדר דודים",
          },
          signals: [
            {
              id: "sig-temp",
              assetId: "asset-boiler-1",
              tenantId: baseAsset.tenantId,
              hotelId: baseAsset.hotelId,
              signalType: "temp_c",
              valueNum: 98,
              valueText: null,
              recordedAt: "2026-08-03T09:00:00.000Z",
              source: "webhook",
              createdAt: "2026-08-03T09:00:00.000Z",
            },
          ],
        },
      ],
      maintenanceRequests: [],
    });

    assert.ok(
      findings.some((item) => item.fingerprint.startsWith("elevator_vibration:")),
    );
    assert.ok(
      findings.some((item) => item.fingerprint.startsWith("boiler_temp:")),
    );
  });

  it("ignores healthy assets without signals or repeat maintenance", () => {
    const findings = detectPredictiveMaintenance({
      nowIso: now,
      assets: [{ asset: baseAsset, signals: [] }],
      maintenanceRequests: [
        {
          id: "m-old",
          tenantId: tenantId as string,
          hotelId: hotelId as string,
          category: "general",
          title: "כללי",
          description: "לא קשור",
          priority: "low",
          status: "done",
          vendorId: null,
          dueAt: null,
          estimatedCost: null,
          actualCost: null,
          createdAt: "2026-05-01T08:00:00.000Z",
          updatedAt: "2026-05-02T08:00:00.000Z",
        },
      ],
    });

    assert.equal(findings.length, 0);
  });

  it("requires minimum repeat count within maintenance window", () => {
    const single = detectPredictiveMaintenance({
      nowIso: now,
      assets: [{ asset: baseAsset, signals: [] }],
      maintenanceRequests: [
        {
          id: "m1",
          tenantId: tenantId as string,
          hotelId: hotelId as string,
          category: "repair",
          title: "מיזוג",
          description: "HVAC-LOBBY",
          priority: "medium",
          status: "open",
          vendorId: null,
          dueAt: null,
          estimatedCost: null,
          actualCost: null,
          createdAt: "2026-07-20T08:00:00.000Z",
          updatedAt: "2026-07-20T08:00:00.000Z",
        },
      ],
    });
    assert.equal(single.length, 0);

    const repeated = detectPredictiveMaintenance({
      nowIso: now,
      assets: [{ asset: baseAsset, signals: [] }],
      maintenanceRequests: Array.from({ length: PM_MAINTENANCE_REPEAT_MIN }, (_, index) => ({
        id: `m-${index}`,
        tenantId: tenantId as string,
        hotelId: hotelId as string,
        category: "repair",
        title: "מיזוג",
        description: "HVAC-LOBBY",
        priority: "medium",
        status: "open",
        vendorId: null,
        dueAt: null,
        estimatedCost: null,
        actualCost: null,
        createdAt: `2026-07-${10 + index}T08:00:00.000Z`,
        updatedAt: `2026-07-${10 + index}T08:00:00.000Z`,
      })),
    });
    assert.equal(repeated.length, 1);
    assert.ok(repeated[0]!.rationaleHe.includes(String(PM_MAINTENANCE_WINDOW_DAYS)));
  });
});
