import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AI_RATE_LIMIT_POLICY,
  DEFAULT_RATE_LIMIT_POLICY,
  STRICT_RATE_LIMIT_POLICY,
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
