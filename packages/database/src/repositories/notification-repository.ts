import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
} from "drizzle-orm";
import type { BookingId, HotelId, TenantId } from "@hotelos/shared";
import type { HotelOsDb } from "../client.js";
import { notificationOutbox } from "../schema/ops.js";

export type NotificationChannel = "whatsapp" | "sms";
export type NotificationStatus = "pending" | "sent" | "failed" | "skipped";

/** Max delivery attempts before a failed row is left as dead-letter (no further cron). */
export const NOTIFICATION_MAX_ATTEMPTS = 5;

export type PersistedNotification = {
  readonly id: string;
  readonly tenantId: string;
  readonly hotelId: string;
  readonly bookingId: string | null;
  readonly channel: NotificationChannel;
  readonly eventKey: string;
  readonly toAddress: string | null;
  readonly body: string;
  readonly status: NotificationStatus;
  readonly error: string | null;
  readonly provider: string;
  readonly attemptCount: number;
  readonly nextAttemptAt: string | null;
  readonly createdAt: string;
  readonly sentAt: string | null;
};

export type EnqueueNotificationInput = {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
  readonly bookingId?: BookingId;
  readonly channel: NotificationChannel;
  readonly eventKey: string;
  readonly toAddress: string | null;
  readonly body: string;
  readonly status: NotificationStatus;
  readonly error?: string | null;
  readonly provider: string;
  readonly attemptCount?: number;
  readonly nextAttemptAt?: string | null;
  readonly createdAt: string;
  readonly sentAt?: string | null;
};

export type MarkFailedMeta = {
  readonly attemptCount: number;
  readonly nextAttemptAt: string | null;
};

export type NotificationRepository = {
  enqueue: (input: EnqueueNotificationInput) => Promise<PersistedNotification>;
  markSent: (
    id: string,
    sentAt: string,
  ) => Promise<PersistedNotification | null>;
  markFailed: (
    id: string,
    error: string,
    meta?: MarkFailedMeta,
  ) => Promise<PersistedNotification | null>;
  markSkipped: (
    id: string,
  ) => Promise<PersistedNotification | null>;
  latestForBooking: (
    tenantId: TenantId,
    bookingId: BookingId,
    eventKey?: string,
  ) => Promise<PersistedNotification | null>;
  listByHotel: (
    tenantId: TenantId,
    hotelId: HotelId,
    limit?: number,
  ) => Promise<readonly PersistedNotification[]>;
  /** Pending/failed rows due for retry (respects backoff + max attempts). */
  listRetryable: (
    limit?: number,
    nowIso?: string,
  ) => Promise<readonly PersistedNotification[]>;
};

function mapRow(
  row: typeof notificationOutbox.$inferSelect,
): PersistedNotification {
  return {
    id: row.id,
    tenantId: row.tenantId,
    hotelId: row.hotelId,
    bookingId: row.bookingId ?? null,
    channel: row.channel as NotificationChannel,
    eventKey: row.eventKey,
    toAddress: row.toAddress ?? null,
    body: row.body,
    status: row.status as NotificationStatus,
    error: row.error ?? null,
    provider: row.provider,
    attemptCount: row.attemptCount ?? 0,
    nextAttemptAt: row.nextAttemptAt ?? null,
    createdAt: row.createdAt,
    sentAt: row.sentAt ?? null,
  };
}

export function createNotificationRepository(
  db: HotelOsDb,
): NotificationRepository {
  return {
    async enqueue(input) {
      const attemptCount = input.attemptCount ?? 0;
      const nextAttemptAt = input.nextAttemptAt ?? null;
      await db
        .insert(notificationOutbox)
        .values({
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
          attemptCount,
          nextAttemptAt,
          createdAt: input.createdAt,
          sentAt: input.sentAt ?? null,
        })
        .run();

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
        attemptCount,
        nextAttemptAt,
        createdAt: input.createdAt,
        sentAt: input.sentAt ?? null,
      };
    },

    async markSent(id, sentAt) {
      await db
        .update(notificationOutbox)
        .set({
          status: "sent",
          sentAt,
          error: null,
          nextAttemptAt: null,
        })
        .where(eq(notificationOutbox.id, id))
        .run();
      const row = await db
        .select()
        .from(notificationOutbox)
        .where(eq(notificationOutbox.id, id))
        .get();
      return row ? mapRow(row) : null;
    },

    async markFailed(id, error, meta) {
      await db
        .update(notificationOutbox)
        .set({
          status: "failed",
          error,
          ...(meta
            ? {
                attemptCount: meta.attemptCount,
                nextAttemptAt: meta.nextAttemptAt,
              }
            : {}),
        })
        .where(eq(notificationOutbox.id, id))
        .run();
      const row = await db
        .select()
        .from(notificationOutbox)
        .where(eq(notificationOutbox.id, id))
        .get();
      return row ? mapRow(row) : null;
    },

    async markSkipped(id) {
      await db
        .update(notificationOutbox)
        .set({ status: "skipped", error: null, nextAttemptAt: null })
        .where(eq(notificationOutbox.id, id))
        .run();
      const row = await db
        .select()
        .from(notificationOutbox)
        .where(eq(notificationOutbox.id, id))
        .get();
      return row ? mapRow(row) : null;
    },

    async latestForBooking(tenantId, bookingId, eventKey) {
      const rows = await db
        .select()
        .from(notificationOutbox)
        .where(
          and(
            eq(notificationOutbox.tenantId, tenantId),
            eq(notificationOutbox.bookingId, bookingId),
            ...(eventKey
              ? [eq(notificationOutbox.eventKey, eventKey)]
              : []),
          ),
        )
        .orderBy(desc(notificationOutbox.createdAt))
        .limit(1)
        .all();
      const row = rows[0];
      return row ? mapRow(row) : null;
    },

    async listByHotel(tenantId, hotelId, limit = 40) {
      const rows = await db
        .select()
        .from(notificationOutbox)
        .where(
          and(
            eq(notificationOutbox.tenantId, tenantId),
            eq(notificationOutbox.hotelId, hotelId),
          ),
        )
        .orderBy(desc(notificationOutbox.createdAt))
        .limit(limit)
        .all();
      return rows.map(mapRow);
    },

    async listRetryable(limit = 50, nowIso = new Date().toISOString()) {
      const rows = await db
        .select()
        .from(notificationOutbox)
        .where(
          and(
            inArray(notificationOutbox.status, ["pending", "failed"]),
            isNotNull(notificationOutbox.toAddress),
            lt(notificationOutbox.attemptCount, NOTIFICATION_MAX_ATTEMPTS),
            or(
              isNull(notificationOutbox.nextAttemptAt),
              lte(notificationOutbox.nextAttemptAt, nowIso),
            ),
          ),
        )
        .orderBy(asc(notificationOutbox.createdAt))
        .limit(limit)
        .all();
      return rows.map(mapRow);
    },
  };
}
