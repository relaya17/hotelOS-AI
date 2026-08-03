import type { NotificationRepository } from "@hotelos/database";
import type { WhatsAppProvider } from "../infrastructure/whatsapp-provider.js";
import { deliverQueuedNotification } from "./enqueue-room-invite-notification.js";

export type DrainNotificationOutboxDeps = {
  readonly notifications: NotificationRepository;
  readonly whatsapp: WhatsAppProvider;
};

export type DrainNotificationOutboxResult = {
  readonly attempted: number;
  readonly sent: number;
  readonly skipped: number;
  readonly failed: number;
};

export async function drainNotificationOutbox(
  deps: DrainNotificationOutboxDeps,
  limit = 50,
): Promise<DrainNotificationOutboxResult> {
  const queue = await deps.notifications.listRetryable(limit);
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of queue) {
    const result = await deliverQueuedNotification(
      deps.notifications,
      deps.whatsapp,
      item,
    );
    if (result.status === "sent") sent += 1;
    else if (result.status === "skipped") skipped += 1;
    else failed += 1;
  }

  return {
    attempted: queue.length,
    sent,
    skipped,
    failed,
  };
}
