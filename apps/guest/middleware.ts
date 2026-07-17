/**
 * Root fix for Vercel: browser talks same-origin (/v1, /health).
 * Edge middleware proxies to the separate API project (no browser CORS).
 *
 * Naming: hotel-os-ai-guest-eight.vercel.app → hotel-os-ai-api-eight.vercel.app
 * Override: set HOTELOS_API_ORIGIN on the Vercel frontend project.
 */
export const config = {
  matcher: ["/v1/:path*", "/health"],
};

function resolveApiOrigin(requestUrl: URL): string {
  const configured = process.env["HOTELOS_API_ORIGIN"]?.trim();
  if (configured && configured.length > 0) {
    return configured.replace(/\/$/, "");
  }
  const apiHost = requestUrl.hostname
    .replace(/-(admin|executive|guest|api)-/i, "-api-")
    .replace(/-(admin|executive|guest|api)\.vercel\./i, "-api.vercel.");
  return `https://${apiHost}`;
}

export default async function middleware(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const target = `${resolveApiOrigin(url)}${url.pathname}${url.search}`;
  const method = request.method;
  const hasBody = method !== "GET" && method !== "HEAD";

  const headers = new Headers(request.headers);
  headers.delete("host");

  return fetch(target, {
    method,
    headers,
    body: hasBody ? request.body : undefined,
    redirect: "manual",
    ...(hasBody ? { duplex: "half" as const } : {}),
  });
}
