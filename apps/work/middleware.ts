/**
 * Root fix for Vercel: browser talks same-origin (/v1, /health).
 * Edge middleware proxies to the separate API project (no browser CORS).
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
    .replace(/-(admin|executive|guest|work|api)-/i, "-api-")
    .replace(/-(admin|executive|guest|work|api)\.vercel\./i, "-api.vercel.");
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
