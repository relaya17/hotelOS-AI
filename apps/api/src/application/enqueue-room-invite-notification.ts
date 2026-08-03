import { randomUUID } from "node:crypto";
import {
  NOTIFICATION_MAX_ATTEMPTS,
  type NotificationRepository,
  type PersistedBooking,
  type PersistedNotification,
} from "@hotelos/database";
import {
  normalizeWhatsAppTo,
  type WhatsAppProvider,
} from "../infrastructure/whatsapp-provider.js";

/** Exponential backoff: 1m, 2m, 4m… capped at 1h. */
export function nextNotificationBackoffMs(attemptCount: number): number {
  const minute = 60_000;
  return Math.min(minute * 2 ** Math.max(attemptCount - 1, 0), 60 * minute);
}

export function buildRoomInviteMessage(booking: PersistedBooking): string {
  return `שלום ${booking.guestName}, חדר ${booking.roomNumber} מוכן. מוזמנים לעלות.`;
}

/** Recover Meta template {{1}}=name, {{2}}=room from stored invite body (for cron retry). */
export function extractRoomInviteTemplateParams(
  body: string,
): readonly string[] | undefined {
  const match =
    /^שלום (.+), חדר (.+) מוכן\. מוזמנים לעלות\.$/u.exec(body.trim());
  if (!match?.[1] || !match[2]) return undefined;
  return [match[1], match[2]];
}

export async function deliverQueuedNotification(
  notifications: NotificationRepository,
  provider: WhatsAppProvider,
  notification: PersistedNotification,
): Promise<PersistedNotification> {
  const phone = notification.toAddress?.trim();
  if (!phone) {
    return (
      (await notifications.markSkipped(notification.id)) ?? notification
    );
  }

  try {
    const templateBodyParams = extractRoomInviteTemplateParams(
      notification.body,
    );
    const result = await provider.sendWhatsApp({
      to: phone,
      body: notification.body,
      ...(templateBodyParams !== undefined ? { templateBodyParams } : {}),
    });
    if (result.status === "skipped") {
      return (
        (await notifications.markSkipped(notification.id)) ?? notification
      );
    }
    return (
      (await notifications.markSent(
        notification.id,
        new Date().toISOString(),
      )) ?? notification
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "WHATSAPP_SEND_FAILED";
    const attemptCount = notification.attemptCount + 1;
    const exhausted = attemptCount >= NOTIFICATION_MAX_ATTEMPTS;
    const nextAttemptAt = exhausted
      ? null
      : new Date(
          Date.now() + nextNotificationBackoffMs(attemptCount),
        ).toISOString();
    const errorText = exhausted
      ? `${message} (DEAD_LETTER after ${attemptCount} attempts)`
      : message;
    return (
      (await notifications.markFailed(notification.id, errorText, {
        attemptCount,
        nextAttemptAt,
      })) ?? notification
    );
  }
}

export async function enqueueRoomInviteNotification(
  notifications: NotificationRepository,
  provider: WhatsAppProvider,
  booking: PersistedBooking,
): Promise<PersistedNotification> {
  const now = new Date().toISOString();
  const rawPhone = booking.guestPhone?.trim() || null;
  const body = buildRoomInviteMessage(booking);

  if (!rawPhone) {
    return notifications.enqueue({
      id: randomUUID(),
      tenantId: booking.tenantId,
      hotelId: booking.hotelId,
      bookingId: booking.id,
      channel: "whatsapp",
      eventKey: "room_prep.invited",
      toAddress: null,
      body,
      status: "skipped",
      error: "NO_PHONE",
      provider: provider.name,
      createdAt: now,
    });
  }

  let toAddress: string;
  try {
    toAddress = normalizeWhatsAppTo(rawPhone);
  } catch {
    return notifications.enqueue({
      id: randomUUID(),
      tenantId: booking.tenantId,
      hotelId: booking.hotelId,
      bookingId: booking.id,
      channel: "whatsapp",
      eventKey: "room_prep.invited",
      toAddress: rawPhone,
      body,
      status: "failed",
      error: "INVALID_PHONE",
      provider: provider.name,
      createdAt: now,
    });
  }

  const notification = await notifications.enqueue({
    id: randomUUID(),
    tenantId: booking.tenantId,
    hotelId: booking.hotelId,
    bookingId: booking.id,
    channel: "whatsapp",
    eventKey: "room_prep.invited",
    toAddress,
    body,
    status: "pending",
    provider: provider.name,
    createdAt: now,
  });

  return deliverQueuedNotification(notifications, provider, notification);
}
