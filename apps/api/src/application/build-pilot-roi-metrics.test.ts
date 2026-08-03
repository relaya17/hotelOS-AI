import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEMO_HOTEL_TLV_ID,
  DEMO_TENANT_ID,
  type BookingRepository,
  type BriefingRepository,
  type HotelRepository,
  type OpsRepository,
  type PersistedBooking,
  type PersistedBriefingRoom,
  type PersistedDepartmentTask,
  type PersistedHotel,
  type PersistedReputationReview,
  type PersistedRevenueSuggestion,
  type PersistedUpsellOffer,
  type ReputationRepository,
  type RevenueSuggestionsRepository,
  type UpsellRepository,
} from "@hotelos/database";
import { Ids, type HotelId, type TenantId } from "@hotelos/shared";
import { buildPilotRoiMetrics } from "./build-pilot-roi-metrics.js";

const tenantId = Ids.tenant(DEMO_TENANT_ID);
const hotelId = Ids.hotel(DEMO_HOTEL_TLV_ID);
const now = new Date("2026-08-01T12:00:00.000Z");

const demoHotel: PersistedHotel = {
  id: hotelId,
  tenantId,
  chainId: "chain-demo",
  name: "TLV Demo",
  timezone: "Asia/Jerusalem",
  currency: "ILS",
  kashrutEnabled: false,
};

function task(
  overrides: Partial<PersistedDepartmentTask> & {
    readonly id: string;
    readonly departmentId: string;
    readonly taskType: string;
  },
): PersistedDepartmentTask {
  return {
    tenantId,
    hotelId,
    title: "Task",
    description: "desc",
    priority: "high",
    status: "open",
    assignedToUserId: null,
    dueAt: null,
    createdAt: "2026-07-10T08:00:00.000Z",
    updatedAt: "2026-07-10T08:00:00.000Z",
    ...overrides,
  };
}

function createDeps(input: {
  readonly briefingRooms?: readonly PersistedBriefingRoom[];
  readonly tasksByDept?: Readonly<Record<string, readonly PersistedDepartmentTask[]>>;
  readonly reviews?: readonly PersistedReputationReview[];
  readonly upsells?: readonly PersistedUpsellOffer[];
  readonly bookings?: readonly PersistedBooking[];
  readonly revenueSuggestions?: readonly PersistedRevenueSuggestion[];
}): Parameters<typeof buildPilotRoiMetrics>[0] {
  const deptIds: Record<string, string> = {
    security: "dept-sec",
    it: "dept-it",
    maintenance: "dept-maint",
    front_office: "dept-fo",
  };

  return {
    hotels: {
      listByTenant: async () => [demoHotel],
    } as unknown as HotelRepository,
    briefing: {
      listByTenant: async () => input.briefingRooms ?? [],
    } as unknown as BriefingRepository,
    bookings: {
      listByHotel: async () => input.bookings ?? [],
    } as unknown as BookingRepository,
    upsells: {
      listByHotel: async () => input.upsells ?? [],
    } as unknown as UpsellRepository,
    reputation: {
      listByHotel: async () => input.reviews ?? [],
    } as unknown as ReputationRepository,
    revenueSuggestions: {
      listByHotel: async () => input.revenueSuggestions ?? [],
    } as unknown as RevenueSuggestionsRepository,
    ops: {
      ensureStandardDepartments: async () => undefined,
      listDepartments: async () =>
        Object.entries(deptIds).map(([code, id]) => ({
          id,
          hotelId,
          code,
          name: code,
        })),
      findDepartmentByCode: async (
        _t: TenantId,
        _h: HotelId,
        code: string,
      ) =>
        deptIds[code]
          ? { id: deptIds[code]!, hotelId, code, name: code }
          : null,
      listTasksByDepartment: async (
        _t: TenantId,
        _h: HotelId,
        departmentId: string,
      ) => input.tasksByDept?.[departmentId] ?? [],
    } as unknown as OpsRepository,
  };
}

describe("buildPilotRoiMetrics", () => {
  it("aggregates live metrics for the window without inventing baselines", async () => {
    const reviewTaskId = "task-review-1";
    const deps = createDeps({
      briefingRooms: [
        {
          id: Ids.briefingRoom("11111111-1111-4111-8111-111111111111"),
          tenantId,
          chainId: Ids.chain("chain-demo"),
          title: "CIO digest בוקר",
          purpose: "תדריך יומי",
          status: "ended",
          hostUserId: Ids.user("host-1"),
          roomKind: "committee",
          inviteToken: "token-1",
          policyVersion: "meetings.2026.1",
          createdAt: "2026-07-15T06:00:00.000Z",
        },
      ],
      tasksByDept: {
        "dept-sec": [
          task({
            id: "inc-1",
            departmentId: "dept-sec",
            taskType: "security_event",
            status: "done",
            createdAt: "2026-07-05T10:00:00.000Z",
            updatedAt: "2026-07-05T14:00:00.000Z",
          }),
        ],
        "dept-it": [
          task({
            id: "auto-1",
            departmentId: "dept-it",
            taskType: "error_event",
            createdAt: "2026-07-20T09:00:00.000Z",
          }),
          task({
            id: "auto-2",
            departmentId: "dept-it",
            taskType: "anomaly_alert",
            createdAt: "2026-07-22T09:00:00.000Z",
          }),
        ],
        "dept-fo": [
          task({
            id: reviewTaskId,
            departmentId: "dept-fo",
            taskType: "reputation_review",
            status: "done",
            createdAt: "2026-07-18T08:00:00.000Z",
            updatedAt: "2026-07-18T20:00:00.000Z",
          }),
        ],
      },
      reviews: [
        {
          id: "rev-1",
          tenantId,
          hotelId,
          source: "google",
          externalId: "g-1",
          rating: 2,
          title: null,
          body: "לא מרוצה",
          authorName: "Guest",
          reviewUrl: null,
          reviewedAt: "2026-07-18T08:00:00.000Z",
          sentiment: "negative",
          topics: [],
          taskId: reviewTaskId,
          createdAt: "2026-07-18T08:00:00.000Z",
        },
      ],
      upsells: [
        {
          id: "up-1",
          tenantId,
          hotelId,
          bookingId: "booking-1",
          guestEmail: "guest@example.com",
          offerType: "spa",
          titleHe: "ספא",
          descriptionHe: "טיפול",
          priceAmount: 200,
          currency: "ILS",
          status: "accepted",
          source: "rules",
          suggestedAt: "2026-07-12T10:00:00.000Z",
          decidedAt: "2026-07-12T11:00:00.000Z",
          createdAt: "2026-07-12T10:00:00.000Z",
        },
        {
          id: "up-2",
          tenantId,
          hotelId,
          bookingId: "booking-2",
          guestEmail: "guest2@example.com",
          offerType: "dinner",
          titleHe: "ארוחה",
          descriptionHe: "דינר",
          priceAmount: 150,
          currency: "ILS",
          status: "declined",
          source: "rules",
          suggestedAt: "2026-07-14T10:00:00.000Z",
          decidedAt: "2026-07-14T12:00:00.000Z",
          createdAt: "2026-07-14T10:00:00.000Z",
        },
      ],
      bookings: [
        {
          id: Ids.booking("booking-prep-1"),
          tenantId,
          hotelId,
          roomId: Ids.room("room-1"),
          guestName: "Guest",
          guestEmail: "guest@example.com",
          guestPhone: null,
          checkInDate: "2026-07-20",
          checkOutDate: "2026-07-22",
          status: "confirmed",
          roomPrepStatus: "ready",
          roomNumber: "101",
        },
      ],
      revenueSuggestions: [
        {
          id: "rev-sug-1",
          tenantId,
          hotelId,
          periodStart: "2026-07-01",
          periodEnd: "2026-07-07",
          currentOccupancyPct: 72,
          suggestedDeltaPct: 5,
          rationaleHe: "ביקוש גבוה",
          status: "approved",
          decidedByUserId: Ids.user("user-1"),
          decidedAt: "2026-07-16T10:00:00.000Z",
          createdAt: "2026-07-15T10:00:00.000Z",
        },
        {
          id: "rev-sug-2",
          tenantId,
          hotelId,
          periodStart: "2026-07-08",
          periodEnd: "2026-07-14",
          currentOccupancyPct: 68,
          suggestedDeltaPct: -3,
          rationaleHe: "עונת שפל",
          status: "rejected",
          decidedByUserId: Ids.user("user-1"),
          decidedAt: "2026-07-18T11:00:00.000Z",
          createdAt: "2026-07-17T10:00:00.000Z",
        },
      ],
    });

    const metrics = await buildPilotRoiMetrics(deps, {
      tenantId,
      hotelId,
      windowDays: 30,
      now,
    });

    assert.ok(metrics);
    assert.equal(metrics.morningBriefingProxy, 1);
    assert.equal(metrics.medianIncidentHandleHours, 4);
    assert.equal(metrics.roomPrepMedianMinutes, null);
    assert.equal(metrics.autoTasksCreated, 4);
    assert.equal(metrics.upsellAcceptedCount, 1);
    assert.equal(metrics.upsellAcceptedRate, 0.5);
    assert.equal(metrics.negativeReviewResponseHours, 12);
    assert.equal(metrics.revenueSuggestionApprovedRate, 0.5);
    assert.ok(metrics.notesHe.some((note) => note.includes("פרוקסי")));
    assert.ok(metrics.notesHe.some((note) => note.includes("baseline")));
    assert.equal(metrics.windowDays, 30);
  });

  it("returns null when hotel is unknown", async () => {
    const deps = createDeps({});
    const metrics = await buildPilotRoiMetrics(deps, {
      tenantId,
      hotelId: Ids.hotel("99999999-9999-4999-8999-999999999999"),
      windowDays: 30,
      now,
    });
    assert.equal(metrics, null);
  });
});
