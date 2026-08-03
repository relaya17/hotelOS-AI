import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AI_RATE_LIMIT_POLICY,
  DEFAULT_RATE_LIMIT_POLICY,
  STRICT_RATE_LIMIT_POLICY,
  STREAM_RATE_LIMIT_POLICY,
  consumeSlidingWindow,
  rateLimitBucketKey,
  selectRateLimitPolicy,
  type SlidingWindowPolicy,
} from "./rate-limit.js";

test("consumeSlidingWindow blocks requests beyond the active window limit", () => {
  const store = new Map<string, number[]>();
  const policy: SlidingWindowPolicy = {
    limit: 2,
    windowMs: 60_000,
  };

  const first = consumeSlidingWindow(store, "127.0.0.1:tenant-a", policy, 0);
  const second = consumeSlidingWindow(store, "127.0.0.1:tenant-a", policy, 1_000);
  const third = consumeSlidingWindow(store, "127.0.0.1:tenant-a", policy, 2_000);
  const fourth = consumeSlidingWindow(store, "127.0.0.1:tenant-a", policy, 60_001);

  assert.equal(first.allowed, true);
  assert.equal(first.remaining, 1);
  assert.equal(second.allowed, true);
  assert.equal(second.remaining, 0);
  assert.equal(third.allowed, false);
  assert.equal(third.remaining, 0);
  assert.equal(third.retryAfterSeconds, 58);
  assert.equal(fourth.allowed, true);
  assert.equal(fourth.remaining, 0);
});

test("selectRateLimitPolicy applies a dedicated AI budget to /v1/ai/*", () => {
  assert.equal(
    selectRateLimitPolicy("/v1/ai/gateway/invoke"),
    AI_RATE_LIMIT_POLICY,
  );
  assert.equal(
    selectRateLimitPolicy("/v1/ai/approvals"),
    AI_RATE_LIMIT_POLICY,
  );
  assert.equal(selectRateLimitPolicy("/v1/auth/login"), STRICT_RATE_LIMIT_POLICY);
  assert.equal(
    selectRateLimitPolicy("/v1/hotels"),
    DEFAULT_RATE_LIMIT_POLICY,
  );
});

test("selectRateLimitPolicy applies a dedicated stream budget to /v1/streams/*", () => {
  assert.equal(
    selectRateLimitPolicy("/v1/streams/ops-dashboard"),
    STREAM_RATE_LIMIT_POLICY,
  );
  assert.equal(
    selectRateLimitPolicy("/v1/streams/other"),
    STREAM_RATE_LIMIT_POLICY,
  );
});

test("rateLimitBucketKey isolates stream traffic from the general API quota", () => {
  assert.equal(
    rateLimitBucketKey("/v1/streams/ops-dashboard", "1.2.3.4", "tenant-a"),
    "stream:1.2.3.4:tenant-a",
  );
});

test("rateLimitBucketKey isolates AI traffic from the general API quota", () => {
  assert.equal(
    rateLimitBucketKey("/v1/ai/gateway/invoke", "1.2.3.4", "tenant-a"),
    "ai:1.2.3.4:tenant-a",
  );
  assert.equal(
    rateLimitBucketKey("/v1/hotels", "1.2.3.4", "tenant-a"),
    "1.2.3.4:tenant-a",
  );
  assert.equal(
    rateLimitBucketKey("/v1/ai/gateway/invoke", "1.2.3.4", null),
    "ai:1.2.3.4:anonymous",
  );
});

test("SSE stream connection opens use the dedicated stream bucket", async () => {
  const { createRateLimitMiddleware, SSE_STREAM_PATH_PREFIX } = await import(
    "./rate-limit.js"
  );
  const store = new Map<string, number[]>();
  const tokens = {
    verifyAccessToken: async () => ({
      userId: "user",
      roles: ["owner"],
      scope: { tenantId: "tenant-a" },
    }),
  } as never;

  const middleware = createRateLimitMiddleware({
    tokens,
    store,
    now: () => 0,
  });

  let nextCalled = false;
  const headers = new Map<string, string>();
  const c = {
    req: {
      path: `${SSE_STREAM_PATH_PREFIX}ops-dashboard`,
      header: (name: string) =>
        name.toLowerCase() === "authorization"
          ? "Bearer test-token"
          : undefined,
      raw: { signal: new AbortController().signal },
    },
    header: (name: string, value?: string) => {
      if (value !== undefined) headers.set(name, value);
    },
  } as never;

  await middleware(c, async () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(store.has("stream:unknown:tenant-a"), true);
  assert.equal(headers.get("x-ratelimit-limit"), "10");
});
