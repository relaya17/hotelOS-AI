import { z } from "@hotelos/validation";

/**
 * Canonical HotelOS error event (matches POST /v1/ops/error-events body + hotelId).
 */
export const hotelOsErrorEventSchema = z.object({
  hotelId: z.string().uuid(),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().min(1).max(4000),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  source: z.string().trim().min(1).max(80).default("sentry"),
  app: z.string().trim().min(1).max(40).optional(),
  externalEventId: z.string().trim().max(120).optional(),
});

export type HotelOsErrorEvent = z.infer<typeof hotelOsErrorEventSchema>;

export type MapSentryWebhookOptions = {
  /** Fallback when Sentry payload has no hotelId tag (env SENTRY_DEFAULT_HOTEL_ID). */
  readonly defaultHotelId?: string;
};

const sentryEnvelopeSchema = z.object({
  action: z.string(),
  data: z.record(z.unknown()).optional(),
});

const sentryIssueSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  shortId: z.string().optional(),
  title: z.string().trim().min(1).max(400),
  culprit: z.string().optional(),
  permalink: z.string().url().optional(),
  web_url: z.string().url().optional(),
  level: z.string().optional(),
  priority: z.string().optional(),
  platform: z.string().optional(),
  project: z
    .object({
      slug: z.string().optional(),
      name: z.string().optional(),
    })
    .optional(),
});

const sentryEventSchema = z.object({
  event_id: z.string().optional(),
  title: z.string().trim().min(1).max(400).optional(),
  message: z.string().optional(),
  level: z.string().optional(),
  platform: z.string().optional(),
  environment: z.string().optional(),
  web_url: z.string().url().optional(),
  tags: z.array(z.tuple([z.string(), z.string()])).optional(),
  project: z.union([z.string(), z.number()]).optional(),
});

/**
 * Map Sentry (or GlitchTip-compatible) webhook JSON → HotelOS IT error event.
 * Returns `null` when the webhook action should not create a task (e.g. issue resolved).
 */
export function mapSentryWebhook(
  body: unknown,
  options: MapSentryWebhookOptions = {},
): HotelOsErrorEvent | null {
  const generic = hotelOsErrorEventSchema.safeParse(body);
  if (generic.success) {
    return generic.data;
  }

  const envelope = sentryEnvelopeSchema.parse(body);
  const action = envelope.action.toLowerCase();
  const data = envelope.data ?? {};

  if (data["issue"] !== undefined) {
    return mapIssueWebhook(action, data["issue"], options);
  }

  if (data["event"] !== undefined) {
    return mapEventAlertWebhook(action, data["event"], options);
  }

  throw new Error("Unrecognized Sentry webhook payload (expected data.issue or data.event)");
}

function mapIssueWebhook(
  action: string,
  rawIssue: unknown,
  options: MapSentryWebhookOptions,
): HotelOsErrorEvent | null {
  if (action !== "created") {
    return null;
  }
  const issue = sentryIssueSchema.parse(rawIssue);
  const hotelId = options.defaultHotelId;
  if (!hotelId) {
    throw new Error(
      "Sentry issue webhook requires hotelId tag on events or SENTRY_DEFAULT_HOTEL_ID on API",
    );
  }

  const level = issue.level ?? issue.priority ?? "error";
  const link = issue.permalink ?? issue.web_url;
  const culprit = issue.culprit ? `\nCulprit: ${issue.culprit}` : "";
  const linkLine = link ? `\n${link}` : "";
  const description = `${issue.title}${culprit}${linkLine}`.trim();

  return hotelOsErrorEventSchema.parse({
    hotelId,
    title: truncateTitle(issue.title),
    description: truncateDescription(description),
    priority: sentryLevelToPriority(level),
    source: "sentry",
    ...(issue.project?.slug ? { app: issue.project.slug.slice(0, 40) } : {}),
    ...(issue.id !== undefined
      ? { externalEventId: String(issue.id).slice(0, 120) }
      : issue.shortId !== undefined
        ? { externalEventId: issue.shortId.slice(0, 120) }
        : {}),
  });
}

function mapEventAlertWebhook(
  action: string,
  rawEvent: unknown,
  options: MapSentryWebhookOptions,
): HotelOsErrorEvent | null {
  if (action !== "triggered" && action !== "created") {
    return null;
  }
  const event = sentryEventSchema.parse(rawEvent);
  const hotelId =
    tagValue(event.tags, "hotelId") ??
    tagValue(event.tags, "hotel_id") ??
    options.defaultHotelId;
  if (!hotelId) {
    throw new Error(
      "Sentry alert webhook requires hotelId tag on the event or SENTRY_DEFAULT_HOTEL_ID on API",
    );
  }

  const title =
    event.title ??
    event.message ??
    (typeof event.project === "string" ? event.project : "Sentry error");
  const envLine = event.environment ? `\nEnvironment: ${event.environment}` : "";
  const linkLine = event.web_url ? `\n${event.web_url}` : "";
  const description = `${title}${envLine}${linkLine}`.trim();

  return hotelOsErrorEventSchema.parse({
    hotelId,
    title: truncateTitle(title),
    description: truncateDescription(description),
    priority: sentryLevelToPriority(event.level ?? "error"),
    source: "sentry",
    ...(typeof event.project === "string"
      ? { app: event.project.slice(0, 40) }
      : {}),
    ...(event.event_id !== undefined
      ? { externalEventId: event.event_id.slice(0, 120) }
      : {}),
  });
}

function tagValue(
  tags: ReadonlyArray<readonly [string, string]> | undefined,
  key: string,
): string | undefined {
  if (!tags) return undefined;
  for (const [k, v] of tags) {
    if (k === key && v.trim().length > 0) {
      return v.trim();
    }
  }
  return undefined;
}

function sentryLevelToPriority(
  level: string,
): "low" | "medium" | "high" | "urgent" {
  const normalized = level.toLowerCase();
  if (normalized === "fatal") return "urgent";
  if (normalized === "error") return "high";
  if (normalized === "warning") return "medium";
  return "low";
}

function truncateTitle(value: string): string {
  const trimmed = value.trim();
  return trimmed.length <= 200 ? trimmed : `${trimmed.slice(0, 197)}…`;
}

function truncateDescription(value: string): string {
  const trimmed = value.trim();
  return trimmed.length <= 4000 ? trimmed : `${trimmed.slice(0, 3997)}…`;
}
