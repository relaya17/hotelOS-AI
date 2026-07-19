export type BrowserSentryOptions = {
  readonly appName: string;
  /** Empty / omitted = Sentry disabled (no network). */
  readonly dsn?: string;
  readonly environment?: string;
};

/**
 * Optional browser Sentry/GlitchTip — no-op when DSN is empty.
 * Complements `installClientErrorReporting` (HotelOS IT inbox for signed-in users).
 */
export function installBrowserSentry(options: BrowserSentryOptions): void {
  if (typeof window === "undefined") return;

  const dsn = options.dsn?.trim() ?? "";
  if (dsn.length === 0) return;

  const environment =
    options.environment?.trim() && options.environment.trim().length > 0
      ? options.environment.trim()
      : "development";

  void import("@sentry/browser")
    .then((Sentry) => {
      Sentry.init({
        dsn,
        environment,
        tracesSampleRate: 0,
        initialScope: {
          tags: { app: options.appName },
        },
      });
    })
    .catch(() => {
      // Never block app boot on observability failures.
    });
}
