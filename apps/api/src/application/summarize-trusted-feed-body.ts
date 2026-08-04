const MAX_SUMMARY = 1200;

export function summarizeFeedBody(
  raw: string,
  contentType: string,
): string {
  if (contentType.includes("application/json")) {
    try {
      const parsed: unknown = JSON.parse(raw);
      return JSON.stringify(parsed).slice(0, MAX_SUMMARY);
    } catch {
      return raw.replace(/\s+/g, " ").trim().slice(0, MAX_SUMMARY);
    }
  }

  const withoutScripts = raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(withoutScripts);
  const metaMatch =
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i.exec(
      withoutScripts,
    ) ??
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i.exec(
      withoutScripts,
    );
  const text = withoutScripts
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  const parts = [
    titleMatch?.[1]?.replace(/\s+/g, " ").trim(),
    metaMatch?.[1]?.replace(/\s+/g, " ").trim(),
    text,
  ].filter((part): part is string => Boolean(part && part.length > 0));

  return parts.join(" · ").slice(0, MAX_SUMMARY);
}
