import assert from "node:assert/strict";
import { test } from "node:test";
import { Ids } from "@hotelos/shared";
import type {
  NotificationRepository,
  PersistedBooking,
  PersistedNotification,
} from "@hotelos/database";
import {
  buildRoomInviteMessage,
  enqueueRoomInviteNotification,
  extractRoomInviteTemplateParams,
} from "./enqueue-room-invite-notification.js";
import type { WhatsAppProvider } from "../infrastructure/whatsapp-provider.js";

function booking(phone: string | null): PersistedBooking {
  return {
    id: Ids.booking("80000000-0000-4000-8000-000000000004"),
    tenantId: Ids.tenant("11111111-1111-4111-8111-111111111111"),
    hotelId: Ids.hotel("33333333-3333-4333-8333-333333333333"),
    roomId: Ids.room("70000000-0000-4000-8000-000000000102"),
    guestName: "יוסי מזרחי",
    guestEmail: "yossi@example.com",
    guestPhone: phone,
    checkInDate: "2026-08-03",
    checkOutDate: "2026-08-05",
    status: "confirmed",
    roomPrepStatus: "invited",
    roomNumber: "102",
  };
}

test("buildRoomInviteMessage is short Hebrew", () => {
  const body = buildRoomInviteMessage(booking("050-1234567"));
  assert.equal(body, "שלום יוסי מזרחי, חדר 102 מוכן. מוזמנים לעלות.");
});

test("extractRoomInviteTemplateParams recovers name and room", () => {
  assert.deepEqual(
    extractRoomInviteTemplateParams(
      "שלום יוסי מזרחי, חדר 102 מוכן. מוזמנים לעלות.",
    ),
    ["יוסי מזרחי", "102"],
  );
  assert.equal(extractRoomInviteTemplateParams("other"), undefined);
});

test("enqueue skips when phone missing", async () => {
  const rows: PersistedNotification[] = [];
  const result = await enqueueRoomInviteNotification(
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
        rows.push(row);
        return row;
      },
      markSent: async () => null,
      markFailed: async () => null,
      markSkipped: async () => null,
      latestForBooking: async () => null,
      listByHotel: async () => rows,
      listRetryable: async () => rows,
    },
    {
      name: "demo",
      sendWhatsApp: async () => {
        throw new Error("provider must not be called without a phone");
      },
    },
    booking(null),
  );
  assert.equal(result.status, "skipped");
  assert.equal(result.error, "NO_PHONE");
});

test("enqueue sends a pending notification with the supplied provider", async () => {
  const rows: PersistedNotification[] = [];
  const statuses: string[] = [];
  const providerCalls: Array<{ to: string; body: string }> = [];
  const notifications = {
    enqueue: async (input: Parameters<NotificationRepository["enqueue"]>[0]) => {
      const row: PersistedNotification = {
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
      rows.push(row);
      statuses.push(row.status);
      return row;
    },
    markSent: async (id: string, sentAt: string) => {
      const row = rows.find((entry) => entry.id === id);
      assert.ok(row);
      const sent = { ...row, status: "sent" as const, error: null, sentAt };
      rows[0] = sent;
      statuses.push(sent.status);
      return sent;
    },
    markFailed: async () => null,
    markSkipped: async () => null,
    latestForBooking: async () => null,
    listByHotel: async () => rows,
    listRetryable: async () => rows.filter((row) => row.status === "pending"),
  } satisfies NotificationRepository;
  const provider: WhatsAppProvider = {
    name: "http",
    async sendWhatsApp(input) {
      providerCalls.push(input);
      return { status: "sent" };
    },
  };

  const result = await enqueueRoomInviteNotification(
    notifications,
    provider,
    booking("050-1234567"),
  );

  assert.deepEqual(statuses, ["pending", "sent"]);
  assert.equal(result.status, "sent");
  assert.equal(result.provider, "http");
  assert.equal(result.toAddress, "+972501234567");
  assert.deepEqual(providerCalls, [
    {
      to: "+972501234567",
      body: "שלום יוסי מזרחי, חדר 102 מוכן. מוזמנים לעלות.",
      templateBodyParams: ["יוסי מזרחי", "102"],
    },
  ]);
});
