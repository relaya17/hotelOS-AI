import assert from "node:assert/strict";
import { test } from "node:test";
import {
  NOTIFICATION_MAX_ATTEMPTS,
  type NotificationRepository,
  type PersistedNotification,
} from "@hotelos/database";
import { drainNotificationOutbox } from "./drain-notification-outbox.js";
import { nextNotificationBackoffMs } from "./enqueue-room-invite-notification.js";

function row(
  overrides: Partial<PersistedNotification> &
    Pick<PersistedNotification, "id" | "status">,
): PersistedNotification {
  return {
    tenantId: "11111111-1111-4111-8111-111111111111",
    hotelId: "33333333-3333-4333-8333-333333333333",
    bookingId: "80000000-0000-4000-8000-000000000004",
    channel: "whatsapp",
    eventKey: "room_prep.invited",
    toAddress: "+972501234567",
    body: "שלום",
    error: overrides.status === "failed" ? "HTTP 500" : null,
    provider: "http",
    attemptCount: 0,
    nextAttemptAt: null,
    createdAt: "2026-08-03T10:00:00.000Z",
    sentAt: null,
    ...overrides,
  };
}

test("drain retries pending/failed and skips already-sent rows", async () => {
  const store: PersistedNotification[] = [
    row({ id: "n1", status: "pending" }),
    row({ id: "n2", status: "failed", error: "HTTP 500" }),
    row({ id: "n3", status: "sent", sentAt: "2026-08-03T09:00:00.000Z" }),
  ];

  const notifications = {
    enqueue: async () => {
      throw new Error("unused");
    },
    markSent: async (id, sentAt) => {
      const current = store.find((entry) => entry.id === id);
      assert.ok(current);
      const updated: PersistedNotification = {
        ...current,
        status: "sent",
        error: null,
        sentAt,
        nextAttemptAt: null,
      };
      store[store.indexOf(current)] = updated;
      return updated;
    },
    markFailed: async (id, error, meta) => {
      const current = store.find((entry) => entry.id === id);
      assert.ok(current);
      const updated: PersistedNotification = {
        ...current,
        status: "failed",
        error,
        attemptCount: meta?.attemptCount ?? current.attemptCount,
        nextAttemptAt:
          meta?.nextAttemptAt !== undefined
            ? meta.nextAttemptAt
            : current.nextAttemptAt,
      };
      store[store.indexOf(current)] = updated;
      return updated;
    },
    markSkipped: async (id) => {
      const current = store.find((entry) => entry.id === id);
      assert.ok(current);
      const updated: PersistedNotification = {
        ...current,
        status: "skipped",
        error: null,
      };
      store[store.indexOf(current)] = updated;
      return updated;
    },
    latestForBooking: async () => null,
    listByHotel: async () => store,
    listRetryable: async () =>
      store.filter(
        (entry) =>
          (entry.status === "pending" || entry.status === "failed") &&
          entry.toAddress !== null &&
          entry.attemptCount < NOTIFICATION_MAX_ATTEMPTS,
      ),
  } satisfies NotificationRepository;

  const result = await drainNotificationOutbox({
    notifications,
    whatsapp: {
      name: "http",
      async sendWhatsApp() {
        return { status: "sent" };
      },
    },
  });

  assert.deepEqual(result, {
    attempted: 2,
    sent: 2,
    skipped: 0,
    failed: 0,
  });
  assert.equal(store[0]?.status, "sent");
  assert.equal(store[1]?.status, "sent");
  assert.equal(store[2]?.status, "sent");
});

test("drain records backoff and dead-letters after max attempts", async () => {
  const store: PersistedNotification[] = [
    row({
      id: "n-dead",
      status: "failed",
      attemptCount: NOTIFICATION_MAX_ATTEMPTS - 1,
      error: "HTTP 500",
    }),
  ];

  const notifications = {
    enqueue: async () => {
      throw new Error("unused");
    },
    markSent: async () => null,
    markFailed: async (id, error, meta) => {
      const current = store.find((entry) => entry.id === id);
      assert.ok(current);
      const updated: PersistedNotification = {
        ...current,
        status: "failed",
        error,
        attemptCount: meta?.attemptCount ?? current.attemptCount,
        nextAttemptAt: meta?.nextAttemptAt ?? null,
      };
      store[store.indexOf(current)] = updated;
      return updated;
    },
    markSkipped: async () => null,
    latestForBooking: async () => null,
    listByHotel: async () => store,
    listRetryable: async () =>
      store.filter(
        (entry) => entry.attemptCount < NOTIFICATION_MAX_ATTEMPTS,
      ),
  } satisfies NotificationRepository;

  const result = await drainNotificationOutbox({
    notifications,
    whatsapp: {
      name: "http",
      async sendWhatsApp() {
        throw new Error("gateway down");
      },
    },
  });

  assert.equal(result.failed, 1);
  assert.equal(store[0]?.attemptCount, NOTIFICATION_MAX_ATTEMPTS);
  assert.equal(store[0]?.nextAttemptAt, null);
  assert.match(store[0]?.error ?? "", /DEAD_LETTER/);
  assert.ok(nextNotificationBackoffMs(1) >= 60_000);
});
