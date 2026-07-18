import type { AppEnv } from "@hotelos/config";
import type { Logger } from "@hotelos/logger";

let sentryEnabled = false;

/**
 * Optional Sentry/GlitchTip — no-op when SENTRY_DSN is empty.
 */
export async function initObservability(
  env: AppEnv,
  logger: Logger,
): Promise<void> {
  const dsn = env.SENTRY_DSN.trim();
  if (dsn.length === 0) {
    logger.info("observability: Sentry disabled (no SENTRY_DSN)");
    return;
  }

  const Sentry = await import("@sentry/node");
  Sentry.init({
    dsn,
    environment:
      env.SENTRY_ENVIRONMENT.trim().length > 0
        ? env.SENTRY_ENVIRONMENT.trim()
        : env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 0,
  });
  sentryEnabled = true;
  logger.info("observability: Sentry enabled", {
    environment: env.SENTRY_ENVIRONMENT || env.NODE_ENV,
  });
}

export function captureException(error: unknown): void {
  if (!sentryEnabled) return;
  void import("@sentry/node").then((Sentry) => {
    Sentry.captureException(error);
  });
}
