/**
 * CORS helpers — supports exact origins and `https://*.vercel.app` wildcards
 * so the three separate Vercel frontends (executive / admin / guest) work
 * without listing every deployment URL.
 */

export function parseCorsOrigins(value: string): readonly string[] {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export function isOriginAllowed(
  origin: string,
  configured: readonly string[],
): boolean {
  if (configured.includes("*") || configured.includes(origin)) {
    return true;
  }

  for (const entry of configured) {
    if (entry === "https://*.vercel.app") {
      if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) {
        return true;
      }
      continue;
    }
    if (entry.startsWith("https://*.") && entry.endsWith(".vercel.app")) {
      // reserved for future subdomain patterns
      if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) {
        return true;
      }
    }
  }

  return false;
}

/** Ensure production always accepts Vercel preview/prod app hosts. */
export function withVercelCorsFallback(
  origins: readonly string[],
  isProduction: boolean,
): readonly string[] {
  if (!isProduction) return origins;
  if (origins.some((entry) => entry.includes("vercel.app") || entry === "*")) {
    return origins;
  }
  return [...origins, "https://*.vercel.app"];
}
