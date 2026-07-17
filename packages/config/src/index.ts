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
  /** Separated by tenant/chain/room under this root */
  RECORDINGS_PATH: z.string().min(1).default(".data/recordings"),
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
  WEBAUTHN_RP_ID: z.string().optional().default("localhost"),
  WEBAUTHN_RP_NAME: z.string().optional().default("HotelOS AI"),
});

export type AppEnv = z.infer<typeof envSchema>;

export function parseCorsOrigins(value: string): readonly string[] {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

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
