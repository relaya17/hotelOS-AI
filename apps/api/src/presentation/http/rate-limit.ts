import type { Context, MiddlewareHandler } from "hono";
import type { JwtTokenService } from "@hotelos/auth";
import { sendError } from "./errors.js";

export type SlidingWindowPolicy = {
  readonly limit: number;
  readonly windowMs: number;
};

export type SlidingWindowDecision = {
  readonly allowed: boolean;
  readonly limit: number;
  readonly remaining: number;
  readonly retryAfterSeconds: number;
  readonly resetAtMs: number;
};

export const DEFAULT_RATE_LIMIT_POLICY: SlidingWindowPolicy = {
  limit: 120,
  windowMs: 60_000,
};

export const STRICT_RATE_LIMIT_POLICY: SlidingWindowPolicy = {
  limit: 20,
  windowMs: 60_000,
};

export type RateLimitOptions = {
  readonly tokens: JwtTokenService;
  readonly now?: () => number;
  readonly store?: Map<string, number[]>;
};

export function consumeSlidingWindow(
  store: Map<string, number[]>,
  key: string,
  policy: SlidingWindowPolicy,
  nowMs: number,
): SlidingWindowDecision {
  const bucket = store.get(key) ?? [];
  const windowStart = nowMs - policy.windowMs;
  const active = bucket.filter((timestamp) => timestamp > windowStart);

  if (active.length >= policy.limit) {
    const oldestTimestamp = active[0] ?? nowMs;
    store.set(key, active);
    return {
      allowed: false,
      limit: policy.limit,
      remaining: 0,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((policy.windowMs - (nowMs - oldestTimestamp)) / 1000),
      ),
      resetAtMs: oldestTimestamp + policy.windowMs,
    };
  }

  active.push(nowMs);
  store.set(key, active);

  return {
    allowed: true,
    limit: policy.limit,
    remaining: Math.max(0, policy.limit - active.length),
    retryAfterSeconds: 0,
    resetAtMs: nowMs + policy.windowMs,
  };
}

export function createRateLimitMiddleware(
  options: RateLimitOptions,
): MiddlewareHandler {
  const store = options.store ?? new Map<string, number[]>();
  const now = options.now ?? (() => Date.now());

  return async (c, next) => {
    if (!c.req.path.startsWith("/v1/")) {
      await next();
      return;
    }

    const policy = selectRateLimitPolicy(c.req.path);
    const ip = getClientIp(c);
    const tenantId = await resolveTenantId(c, options.tokens);
    const decision = consumeSlidingWindow(
      store,
      `${ip}:${tenantId ?? "anonymous"}`,
      policy,
      now(),
    );

    c.header("x-ratelimit-limit", String(decision.limit));
    c.header("x-ratelimit-remaining", String(decision.remaining));
    c.header(
      "x-ratelimit-reset",
      String(Math.max(0, Math.ceil(decision.resetAtMs / 1000))),
    );

    if (!decision.allowed) {
      c.header("retry-after", String(decision.retryAfterSeconds));
      return sendError(
        c,
        429,
        "RATE_LIMITED",
        "יותר מדי בקשות. נסו שוב בעוד דקה. / Too many requests. Please try again in about a minute.",
        {
          limit: decision.limit,
          windowSeconds: Math.round(policy.windowMs / 1000),
          retryAfterSeconds: decision.retryAfterSeconds,
        },
      );
    }

    await next();
  };
}

function selectRateLimitPolicy(pathname: string): SlidingWindowPolicy {
  if (
    pathname === "/v1/auth/login" ||
    pathname.startsWith("/v1/public/stays/")
  ) {
    return STRICT_RATE_LIMIT_POLICY;
  }
  return DEFAULT_RATE_LIMIT_POLICY;
}

async function resolveTenantId(
  c: Context,
  tokens: JwtTokenService,
): Promise<string | null> {
  const authorization = c.req.header("authorization");
  if (authorization?.startsWith("Bearer ")) {
    try {
      const principal = await tokens.verifyAccessToken(
        authorization.slice("Bearer ".length),
      );
      return principal.scope.tenantId;
    } catch {
      // Ignore invalid bearer tokens here and let auth middleware handle them later.
    }
  }

  for (const headerName of ["x-tenant-id", "x-hotelos-tenant", "tenant-id"]) {
    const tenantId = c.req.header(headerName)?.trim();
    if (tenantId) {
      return tenantId;
    }
  }

  return null;
}

function getClientIp(c: Context): string {
  const forwardedFor = extractFirstIp(c.req.header("x-forwarded-for"));
  if (forwardedFor) {
    return forwardedFor;
  }

  const realIp = extractFirstIp(c.req.header("x-real-ip"));
  if (realIp) {
    return realIp;
  }

  const cloudflareIp = extractFirstIp(c.req.header("cf-connecting-ip"));
  if (cloudflareIp) {
    return cloudflareIp;
  }

  const forwardedHeader = c.req.header("forwarded");
  if (forwardedHeader) {
    const match = /for="?(\[[^\]]+\]|[^;,\s"]+)/i.exec(forwardedHeader);
    const forwardedIp = normalizeIp(match?.[1]);
    if (forwardedIp) {
      return forwardedIp;
    }
  }

  return "unknown";
}

function extractFirstIp(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const first = value.split(",")[0]?.trim();
  return normalizeIp(first);
}

function normalizeIp(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/^\[|\]$/g, "").trim();
  return normalized.length > 0 ? normalized : null;
}
