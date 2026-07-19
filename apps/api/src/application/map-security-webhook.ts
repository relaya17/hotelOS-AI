import { z } from "@hotelos/validation";

/**
 * Canonical HotelOS security event (PO: connector-agnostic first).
 * Vendor adapters map their payload into this shape before POST /security-events.
 */
export const hotelOsSecurityEventSchema = z.object({
  hotelId: z.string().uuid(),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().min(1).max(4000),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("high"),
  source: z.string().trim().min(1).max(80).default("webhook"),
  occurredAt: z.string().datetime().optional(),
  externalEventId: z.string().trim().max(120).optional(),
});

export type HotelOsSecurityEvent = z.infer<typeof hotelOsSecurityEventSchema>;

export type SecurityWebhookProvider = "generic" | "example_vms";

/**
 * Map a vendor (or already-canonical) webhook body to HotelOS security event.
 * `example_vms` is a stand-in until the pilot hotel's real VMS is known.
 */
export function mapSecurityWebhook(
  provider: SecurityWebhookProvider,
  body: unknown,
): HotelOsSecurityEvent {
  if (provider === "generic") {
    return hotelOsSecurityEventSchema.parse(body);
  }

  // Example VMS shape — replace with real Milestone/Genetec/local adapter later.
  const exampleSchema = z.object({
    site_id: z.string().uuid(),
    alarm_name: z.string().trim().min(2).max(200),
    alarm_text: z.string().trim().min(1).max(4000),
    severity: z
      .enum(["info", "warning", "critical", "emergency"])
      .default("warning"),
    camera_id: z.string().trim().max(80).optional(),
    event_id: z.string().trim().max(120).optional(),
    timestamp: z.string().optional(),
  });
  const parsed = exampleSchema.parse(body);
  const priority =
    parsed.severity === "emergency"
      ? "urgent"
      : parsed.severity === "critical"
        ? "high"
        : parsed.severity === "warning"
          ? "medium"
          : "low";
  const camera =
    parsed.camera_id !== undefined ? ` מצלמה ${parsed.camera_id}.` : "";

  return hotelOsSecurityEventSchema.parse({
    hotelId: parsed.site_id,
    title: parsed.alarm_name,
    description: `${parsed.alarm_text}${camera}`,
    priority,
    source: "example_vms",
    ...(parsed.timestamp !== undefined
      ? { occurredAt: normalizeTimestamp(parsed.timestamp) }
      : {}),
    ...(parsed.event_id !== undefined
      ? { externalEventId: parsed.event_id }
      : {}),
  });
}

function normalizeTimestamp(value: string): string | undefined {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return undefined;
  return new Date(ms).toISOString();
}
