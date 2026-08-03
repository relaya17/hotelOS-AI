import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "critical"]).default("info"),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 14),
  /** `file:.data/hotelos.sqlite` locally, or a hosted `libsql://...` (Turso) URL in production */
  DATABASE_URL: z.string().min(1).default("file:.data/hotelos.sqlite"),
  /** Required only when DATABASE_URL points at a hosted Turso database */
  DATABASE_AUTH_TOKEN: z.string().optional().default(""),
  /** Separated by tenant/chain/room under this root (local object storage) */
  RECORDINGS_PATH: z.string().min(1).default(".data/recordings"),
  /**
   * Optional Vercel Blob read/write token. When set, recordings use Blob
   * instead of local disk (required for durable files on Vercel).
   */
  BLOB_READ_WRITE_TOKEN: z.string().optional().default(""),
  /** Comma-separated origins for the three separate apps */
  CORS_ORIGINS: z
    .string()
    .min(1)
    .default(
      "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176",
    ),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  GOOGLE_REDIRECT_URI: z
    .string()
    .optional()
    .default("http://localhost:3001/v1/trust/oauth/google/callback"),
  /** Where the browser lands after a successful Google OAuth callback */
  GOOGLE_POST_LOGIN_REDIRECT: z
    .string()
    .optional()
    .default("http://localhost:5173/"),
  WEBAUTHN_RP_ID: z.string().optional().default("localhost"),
  WEBAUTHN_RP_NAME: z.string().optional().default("HotelOS AI"),
  /**
   * Demo Google login (`POST /v1/trust/oauth/google/demo`).
   * Empty = enabled outside production, disabled in production.
   * Set `true` / `false` to force.
   */
  ALLOW_DEMO_AUTH: z.enum(["true", "false", ""]).optional().default(""),
  /**
   * Seed demo tenant/admin on API boot.
   * Empty = enabled outside production, disabled in production.
   * Set `true` / `false` to force.
   */
  ALLOW_DEMO_SEED: z.enum(["true", "false", ""]).optional().default(""),
  /**
   * AI Gateway — OpenAI-compatible Chat Completions.
   * When empty, Gateway uses the built-in deterministic provider (always on).
   */
  AI_GATEWAY_API_KEY: z.string().optional().default(""),
  AI_GATEWAY_BASE_URL: z
    .string()
    .optional()
    .default("https://api.openai.com/v1"),
  AI_GATEWAY_MODEL: z.string().optional().default("gpt-4o-mini"),
  AI_GATEWAY_EMBED_MODEL: z
    .string()
    .optional()
    .default("text-embedding-3-small"),
  /**
   * Shared secret for `/v1/cron/*` (Vercel Cron / external scheduler).
   * Empty = cron endpoints disabled (503).
   */
  CRON_SECRET: z.string().optional().default(""),
  /** Optional Sentry DSN for API error monitoring (empty = disabled). */
  SENTRY_DSN: z.string().optional().default(""),
  /** Optional Sentry environment tag (defaults to NODE_ENV). */
  SENTRY_ENVIRONMENT: z.string().optional().default(""),
  /**
   * Shared secret for POST /v1/public/sentry/ingest (Sentry → IT department_tasks).
   * Empty = public ingest disabled in production; allowed open in non-production.
   */
  SENTRY_INGEST_SECRET: z.string().optional().default(""),
  /**
   * Optional default hotel UUID for Sentry webhooks when events lack a hotelId tag.
   * Prefer tagging events in Sentry SDK instead (see docs/deployment/vercel.md).
   */
  SENTRY_DEFAULT_HOTEL_ID: z.string().optional().default(""),
  /** PMS connector for Digital Twin merge. */
  PMS_PROVIDER: z
    .enum([
      "demo",
      "mews_stub",
      "mews",
      "opera_stub",
      "protel_stub",
      "fidelio_stub",
      "clock_stub",
    ])
    .default("demo"),
  /** Mews Connector API — required when PMS_PROVIDER=mews. */
  MEWS_CLIENT_TOKEN: z.string().optional().default(""),
  MEWS_ACCESS_TOKEN: z.string().optional().default(""),
  /** Demo: https://api.mews-demo.com · production: https://api.mews.com */
  MEWS_PLATFORM_URL: z
    .string()
    .optional()
    .default("https://api.mews-demo.com"),
  MEWS_CLIENT_NAME: z.string().optional().default("HotelOS AI 1.0"),
  /**
   * Payment path for Trust + public booking.
   * demo = local PCI-free confirm · stripe_stub = fake clientSecret ·
   * external = HTTP gateway (card PAN never touches HotelOS).
   */
  PAYMENT_PROVIDER: z
    .enum(["demo", "stripe_stub", "external"])
    .default("demo"),
  /** Required when PAYMENT_PROVIDER=external — create/confirm intents at this base URL. */
  PAYMENT_EXTERNAL_URL: z.string().optional().default(""),
  PAYMENT_EXTERNAL_TOKEN: z.string().optional().default(""),
  /**
   * Optional shared secret for POST /v1/public/pms/inbound (channel manager → HotelOS).
   * Empty = endpoint accepts unauthenticated demo payloads (dev only).
   */
  PMS_INBOUND_SECRET: z.string().optional().default(""),
  /**
   * Shared secret for POST /v1/public/security/ingest/:provider (VMS webhooks).
   * Empty = public ingest disabled in production; allowed open in non-production.
   */
  SECURITY_INGEST_SECRET: z.string().optional().default(""),
  /**
   * Shared secret for POST /v1/public/reputation/ingest/:provider (OTA review webhooks).
   * Empty = public ingest disabled in production; allowed open in non-production.
   */
  REPUTATION_INGEST_SECRET: z.string().optional().default(""),
  /**
   * Shared secret for POST /v1/public/energy/ingest (BMS / meter webhooks).
   * Empty = public ingest disabled in production; allowed open in non-production.
   */
  ENERGY_INGEST_SECRET: z.string().optional().default(""),
  /**
   * Shared secret for POST /v1/public/equipment/ingest (sensor webhook stub).
   * Empty = public ingest disabled in production; allowed open in non-production.
   */
  EQUIPMENT_INGEST_SECRET: z.string().optional().default(""),
  /** WhatsApp delivery adapter. Empty configuration remains safe demo delivery. */
  WHATSAPP_PROVIDER: z
    .enum(["demo", "http", "meta", "off"])
    .default("demo"),
  /** HTTP WhatsApp gateway endpoint, required when WHATSAPP_PROVIDER=http. */
  WHATSAPP_API_URL: z.string().optional().default(""),
  /**
   * Bearer token: generic gateway (`http`) or Meta Cloud API permanent/system token (`meta`).
   */
  WHATSAPP_API_TOKEN: z.string().optional().default(""),
  /** Meta WhatsApp Business phone number id — required when WHATSAPP_PROVIDER=meta. */
  WHATSAPP_META_PHONE_NUMBER_ID: z.string().optional().default(""),
  /** Graph API version for Meta Cloud API. */
  WHATSAPP_META_GRAPH_VERSION: z.string().optional().default("v21.0"),
  /**
   * Optional approved Meta template name for cold outreach (room invites).
   * Empty = session text messages only (works inside the 24h customer-care window).
   */
  WHATSAPP_META_TEMPLATE_NAME: z.string().optional().default(""),
  /** Template language code (e.g. he, en_US). */
  WHATSAPP_META_TEMPLATE_LANGUAGE: z.string().optional().default("he"),
  /**
   * Optional phone number (E.164 or Israeli local) that also receives the
   * scheduled CIO daily digest over WhatsApp. Empty = in-app inbox only
   * (org-comms `cio_daily` channel) — stage ד' follow-up (PO decision 2).
   */
  DIGEST_WHATSAPP_TO: z.string().optional().default(""),
});

export type AppEnv = z.infer<typeof envSchema>;

export {
  isOriginAllowed,
  parseCorsOrigins,
  withVercelCorsFallback,
} from "./cors.js";

export { isDemoAuthEnabled, isDemoSeedEnabled } from "./demo-flags.js";

export function loadEnv(
  source: Record<string, string | undefined> = process.env,
): AppEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return parsed.data;
}
