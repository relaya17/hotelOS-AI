import type { MiddlewareHandler } from "hono";

/** Baseline 2026 API security headers (HSTS only outside local/dev). */
export function securityHeaders(isProduction: boolean): MiddlewareHandler {
  return async (c, next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("Referrer-Policy", "no-referrer");
    c.header(
      "Permissions-Policy",
      "camera=(self), microphone=(self), geolocation=(self), payment=(self)",
    );
    c.header("Cross-Origin-Resource-Policy", "same-site");
    if (isProduction) {
      c.header(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains",
      );
    }
  };
}
