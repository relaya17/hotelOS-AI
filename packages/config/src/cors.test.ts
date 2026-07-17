import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isOriginAllowed,
  parseCorsOrigins,
  withVercelCorsFallback,
} from "./cors.js";

describe("cors helpers", () => {
  it("parses comma-separated origins", () => {
    assert.deepEqual(
      parseCorsOrigins("http://localhost:5173, https://a.vercel.app"),
      ["http://localhost:5173", "https://a.vercel.app"],
    );
  });

  it("allows exact and vercel wildcard", () => {
    const configured = [
      "http://localhost:5174",
      "https://*.vercel.app",
    ] as const;
    assert.equal(
      isOriginAllowed("http://localhost:5174", configured),
      true,
    );
    assert.equal(
      isOriginAllowed("https://hotel-os-ai-admin-eight.vercel.app", configured),
      true,
    );
    assert.equal(
      isOriginAllowed("https://evil.example.com", configured),
      false,
    );
  });

  it("adds vercel wildcard in production when missing", () => {
    const next = withVercelCorsFallback(
      ["http://localhost:5173"],
      true,
    );
    assert.ok(next.includes("https://*.vercel.app"));
  });
});
