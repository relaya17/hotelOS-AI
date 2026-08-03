import assert from "node:assert/strict";
import { test } from "node:test";
import { Ids } from "@hotelos/shared";
import type { AuthPrincipal } from "@hotelos/auth";
import type {
  EnqueueNotificationInput,
  NotificationRepository,
  PersistedBooking,
  PersistedNotification,
  RoomPrepAction,
} from "@hotelos/database";
import { updateBookingRoomPrep } from "./update-booking-room-prep.js";
import type { WhatsAppProvider } from "../infrastructure/whatsapp-provider.js";

const principal: AuthPrincipal = {
  userId: Ids.user("55555555-5555-4555-8555-555555555555"),
  roles: ["admin"],
  scope: { tenantId: Ids.tenant("11111111-1111-4111-8111-111111111111") },
};

const demoWhatsApp: WhatsAppProvider = {
  name: "demo",
  async sendWhatsApp() {
    return { status: "sent" };
  },
};

function sampleBooking(
  roomPrepStatus: PersistedBooking["roomPrepStatus"],
  guestPhone: string | null = "050-1234567",
): PersistedBooking {
  return {
    id: Ids.booking("80000000-0000-4000-8000-000000000004"),
    tenantId: Ids.tenant("11111111-1111-4111-8111-111111111111"),
    hotelId: Ids.hotel("33333333-3333-4333-8333-333333333333"),
    roomId: Ids.room("70000000-0000-4000-8000-000000000102"),
    guestName: "יוסי מזרחי",
    guestEmail: "yossi@example.com",
    guestPhone,
    checkInDate: "2026-08-03",
    checkOutDate: "2026-08-05",
    status: "confirmed",
    roomPrepStatus,
    roomNumber: "102",
  };
}

function toPersisted(input: EnqueueNotificationInput): PersistedNotification {
  return {
    id: input.id,
    tenantId: input.tenantId,
    hotelId: input.hotelId,
    bookingId: input.bookingId ?? null,
    channel: input.channel,
    eventKey: input.eventKey,
    toAddress: input.toAddress,
    body: input.body,
    status: input.status,
    error: input.error ?? null,
    provider: input.provider,
    attemptCount: input.attemptCount ?? 0,
    nextAttemptAt: input.nextAttemptAt ?? null,
    createdAt: input.createdAt,
    sentAt: input.sentAt ?? null,
  };
}

function notificationsStub(
  store: PersistedNotification[],
): NotificationRepository {
  return {
    enqueue: async (input) => {
      const row = toPersisted(input);
      store.push(row);
      return row;
    },
    markSent: async () => null,
    markFailed: async () => null,
    markSkipped: async () => null,
    latestForBooking: async () => null,
    listByHotel: async () => store,
    listRetryable: async () =>
      store.filter(
        (row) =>
          (row.status === "pending" || row.status === "failed") &&
          row.toAddress !== null,
      ),
  };
}

const guestEmailLookupStubs = {
  listByGuestEmailAtHotel: async () => [] as const,
  listByGuestEmailInChain: async () => [] as const,
};

test("updateBookingRoomPrep invites only when ready", async () => {
  const audits: string[] = [];
  const result = await updateBookingRoomPrep(
    {
      hotelBelongsToTenant: async () => true,
      findRoomInHotel: async () => null,
      listByHotel: async () => [],
      ...guestEmailLookupStubs,
      findByIdInHotel: async () => sampleBooking("waiting"),
      updateStatus: async () => null,
      setRoomPrep: async (_t, _h, _b, action: RoomPrepAction) => {
        if (action === "invited") {
          return { ok: false, reason: "INVALID_TRANSITION" };
        }
        return { ok: true, booking: sampleBooking("waiting") };
      },
      advanceRoomPrepForDirtyRoom: async () => undefined,
      advanceRoomPrepForVacantRoom: async () => undefined,
      create: async () => {
        throw new Error("unused");
      },
    },
    {
      append: async (entry) => {
        audits.push(entry.action);
      },
    },
    notificationsStub([]),
    demoWhatsApp,
    principal,
    {
      hotelId: "33333333-3333-4333-8333-333333333333",
      bookingId: "80000000-0000-4000-8000-000000000004",
      status: "invited",
    },
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "INVALID_TRANSITION");
  }
  assert.equal(audits.length, 0);
});

test("updateBookingRoomPrep audits successful waiting mark", async () => {
  const audits: string[] = [];
  const result = await updateBookingRoomPrep(
    {
      hotelBelongsToTenant: async () => true,
      findRoomInHotel: async () => null,
      listByHotel: async () => [],
      ...guestEmailLookupStubs,
      findByIdInHotel: async () => sampleBooking(null),
      updateStatus: async () => null,
      setRoomPrep: async () => ({
        ok: true,
        booking: sampleBooking("cleaning"),
      }),
      advanceRoomPrepForDirtyRoom: async () => undefined,
      advanceRoomPrepForVacantRoom: async () => undefined,
      create: async () => {
        throw new Error("unused");
      },
    },
    {
      append: async (entry) => {
        audits.push(entry.action);
      },
    },
    notificationsStub([]),
    demoWhatsApp,
    principal,
    {
      hotelId: "33333333-3333-4333-8333-333333333333",
      bookingId: "80000000-0000-4000-8000-000000000004",
      status: "waiting",
    },
  );

  assert.equal(result.ok, true);
  assert.deepEqual(audits, ["booking.room_prep.waiting"]);
});

test("invite enqueues demo WhatsApp notification when phone exists", async () => {
  const audits: string[] = [];
  const outbox: PersistedNotification[] = [];
  const invited = sampleBooking("invited");
  const result = await updateBookingRoomPrep(
    {
      hotelBelongsToTenant: async () => true,
      findRoomInHotel: async () => null,
      listByHotel: async () => [],
      ...guestEmailLookupStubs,
      findByIdInHotel: async () => sampleBooking("ready"),
      updateStatus: async () => null,
      setRoomPrep: async () => ({ ok: true, booking: invited }),
      advanceRoomPrepForDirtyRoom: async () => undefined,
      advanceRoomPrepForVacantRoom: async () => undefined,
      create: async () => {
        throw new Error("unused");
      },
    },
    {
      append: async (entry) => {
        audits.push(entry.action);
      },
    },
    {
      enqueue: async (input) => {
        const row = {
          id: input.id,
          tenantId: input.tenantId,
          hotelId: input.hotelId,
          bookingId: input.bookingId ?? null,
          channel: input.channel,
          eventKey: input.eventKey,
          toAddress: input.toAddress,
          body: input.body,
          status: input.status,
          error: input.error ?? null,
          provider: input.provider,
          attemptCount: input.attemptCount ?? 0,
          nextAttemptAt: input.nextAttemptAt ?? null,
          createdAt: input.createdAt,
          sentAt: input.sentAt ?? null,
        };
        outbox.push(row);
        return row;
      },
      markSent: async (id, sentAt) => {
        const row = outbox.find((entry) => entry.id === id);
        return row ? { ...row, status: "sent", error: null, sentAt } : null;
      },
      markFailed: async () => null,
      markSkipped: async () => null,
      latestForBooking: async () => null,
      listByHotel: async () => outbox,
      listRetryable: async () => outbox,
    },
    demoWhatsApp,
    principal,
    {
      hotelId: "33333333-3333-4333-8333-333333333333",
      bookingId: "80000000-0000-4000-8000-000000000004",
      status: "invited",
    },
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.notification?.status, "sent");
    assert.equal(result.value.notification?.toAddress, "+972501234567");
    assert.match(result.value.notification?.body ?? "", /חדר 102/);
  }
  assert.ok(audits.includes("booking.room_prep.invited"));
  assert.ok(audits.includes("notification.room_invite"));
  assert.equal(outbox.length, 1);
});
