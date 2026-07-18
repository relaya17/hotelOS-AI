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
      "http://localhost:5173,http://localhost:5174,http://localhost:5175",
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
   * AI Gateway — OpenAI-compatible Chat Completions.
   * When empty, Gateway uses the built-in deterministic provider (always on).
   */
  AI_GATEWAY_API_KEY: z.string().optional().default(""),
  AI_GATEWAY_BASE_URL: z
    .string()
    .optional()
    .default("https://api.openai.com/v1"),
  AI_GATEWAY_MODEL: z.string().optional().default("gpt-4o-mini"),
});

export type AppEnv = z.infer<typeof envSchema>;

export {
  isOriginAllowed,
  parseCorsOrigins,
  withVercelCorsFallback,
} from "./cors.js";

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
